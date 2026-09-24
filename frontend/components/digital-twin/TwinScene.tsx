"use client";

import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ComponentRef } from "react";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Html, OrbitControls, PerformanceMonitor } from "@react-three/drei";
import * as THREE from "three";
import BuildingDetail from "./BuildingDetail";
import {
    cameraFraming,
    describeSensor,
    formatKw,
    measurePath,
    sensorLabel,
    stressColour,
    writePointAlongPath,
    type CameraFraming,
    type LoadLens,
    type ReadingStore,
    type SensorPlacement,
    type SensorState,
    type StressPalette,
    type FacadeStyle,
    type MassingBlock,
    type TwinLayout,
    type TwinLimits,
    type TwinMassing,
} from "@/lib/digitalTwin";

export type ScenePalette = StressPalette & {
    idle: string;
    primary: string;
    secondary: string;
    surface: string;
    surfaceAlt: string;
    ink: string;
    background: string;
};

export type TwinSceneProps = {
    layout: TwinLayout;
    store: ReadingStore;
    lens: LoadLens;
    limits: TwinLimits;
    palette: ScenePalette;
    dark: boolean;
    selectedId: string | null;
    onSelect: (sensorId: string | null) => void;
    active: boolean;
    reducedMotion: boolean;
    resetToken: number;
    onContextLost: () => void;
    solarPanels?: number;
};

type ControlsHandle = ComponentRef<typeof OrbitControls>;

type SensorVisual = {
    colour: THREE.Color;
    stress: number;
    power: number;
    live: boolean;
    state: SensorState;
    radius: number;
};

type VisualState = {
    visuals: SensorVisual[];
    floorStress: Float32Array;
    floorColours: THREE.Color[];
    aggregateColour: THREE.Color;
    maxPower: number;
    anyLive: boolean;
    seenVersion: number;
    refreshedAt: number;
    dirty: boolean;
};

type VisualSource = {
    state: VisualState;
    refresh: (elapsed: number) => void;
};

const TAG_TEXT: Record<SensorState, string> = {
    live: "",
    stale: "Signal lost",
    waiting: "Waiting for data",
    offline: "Offline",
    maintenance: "Maintenance",
};

const FOV = 40;
const scratchMatrix = new THREE.Matrix4();
const scratchColour = new THREE.Color();

function approachColour(current: THREE.Color, target: THREE.Color, amount: number): boolean {
    const gap = Math.abs(current.r - target.r) + Math.abs(current.g - target.g) + Math.abs(current.b - target.b);
    current.lerp(target, amount);
    return gap > 0.003;
}

function createGlowMaterial(additive: boolean): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
        uniforms: { pointScale: { value: 400 } },
        vertexShader: `
            attribute float size;
            attribute float alpha;
            attribute vec3 tint;
            uniform float pointScale;
            varying vec3 vTint;
            varying float vAlpha;
            void main() {
                vTint = tint;
                vAlpha = alpha;
                vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
                gl_PointSize = size * pointScale / max(-viewPosition.z, 0.1);
                gl_Position = projectionMatrix * viewPosition;
            }
        `,
        fragmentShader: `
            varying vec3 vTint;
            varying float vAlpha;
            void main() {
                float falloff = 1.0 - smoothstep(0.0, 0.5, length(gl_PointCoord - 0.5));
                float strength = falloff * falloff * vAlpha;
                if (strength < 0.01) discard;
                gl_FragColor = vec4(vTint, strength);
                #include <colorspace_fragment>
            }
        `,
        transparent: true,
        depthWrite: false,
        blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
}

function useGlowMaterial(additive: boolean): THREE.ShaderMaterial {
    const material = useMemo(() => createGlowMaterial(additive), [additive]);
    useEffect(() => () => material.dispose(), [material]);
    useFrame((frame) => {
        const camera = frame.camera as THREE.PerspectiveCamera;
        const halfFov = THREE.MathUtils.degToRad((camera.fov ?? FOV) / 2);
        material.uniforms.pointScale.value = (frame.size.height * frame.gl.getPixelRatio() * 0.5) / Math.tan(halfFov);
    });
    return material;
}

function floorIndexOf(placement: SensorPlacement, layout: TwinLayout): number {
    if (placement.kind === "incomer") {
        return -1;
    }
    return placement.kind === "roof" ? layout.floors : placement.floor;
}

function useVisualSource(
    layout: TwinLayout,
    store: ReadingStore,
    lens: LoadLens,
    limits: TwinLimits,
    palette: ScenePalette,
): VisualSource {
    const state = useMemo<VisualState>(() => ({
        visuals: layout.placements.map(() => ({
            colour: new THREE.Color(),
            stress: -1,
            power: 0,
            live: false,
            state: "waiting",
            radius: 0.2,
        })),
        floorStress: new Float32Array(layout.floors + 1).fill(-1),
        floorColours: Array.from({ length: layout.floors + 1 }, () => new THREE.Color()),
        aggregateColour: new THREE.Color(),
        maxPower: 0,
        anyLive: false,
        seenVersion: -1,
        refreshedAt: Number.NEGATIVE_INFINITY,
        dirty: true,
    }), [layout]);

    useEffect(() => {
        state.dirty = true;
    }, [state, lens, limits, palette]);

    const refresh = useCallback((elapsed: number) => {
        const version = store.version();
        const since = elapsed - state.refreshedAt;
        const versionChanged = version !== state.seenVersion;
        if (!state.dirty && since < 1 && (!versionChanged || since < 0.2)) {
            return;
        }
        state.dirty = false;
        state.seenVersion = version;
        state.refreshedAt = elapsed;

        const now = Date.now();
        const idle = scratchColour.set(palette.idle);
        let maxPower = 0;
        let peakStress = -1;
        let incomerStress = -1;
        let anyLive = false;
        state.floorStress.fill(-1);

        layout.placements.forEach((placement, index) => {
            const view = describeSensor(placement.sensor, store.get(placement.sensor.sensor_id), lens, limits, now);
            const visual = state.visuals[index];
            visual.state = view.state;
            visual.live = view.state === "live";
            visual.power = visual.live ? Math.max(0, view.powerKw ?? 0) : 0;
            visual.stress = view.stress ?? -1;

            if (!visual.live) {
                if (view.state === "maintenance") {
                    visual.colour.set(palette.elevated).lerp(idle, 0.45);
                } else {
                    visual.colour.copy(idle);
                }
                return;
            }

            visual.colour.set(view.stress === null ? palette.primary : stressColour(view.stress, palette));
            anyLive = true;
            maxPower = Math.max(maxPower, visual.power);
            peakStress = Math.max(peakStress, visual.stress);
            const floorIndex = floorIndexOf(placement, layout);
            if (floorIndex < 0) {
                incomerStress = Math.max(incomerStress, Math.max(visual.stress, 0));
            } else {
                state.floorStress[floorIndex] = Math.max(state.floorStress[floorIndex], Math.max(visual.stress, 0));
            }
        });

        state.visuals.forEach((visual) => {
            const share = maxPower > 0 ? visual.power / maxPower : 0;
            visual.radius = visual.live ? 0.34 + 0.24 * Math.sqrt(share) : 0.28;
        });

        state.floorColours.forEach((colour, floorIndex) => {
            if (state.floorStress[floorIndex] < 0 && incomerStress >= 0) {
                state.floorStress[floorIndex] = incomerStress;
            }
            const stress = state.floorStress[floorIndex];
            colour.set(stress >= 0 ? stressColour(stress, palette) : palette.primary);
        });

        state.aggregateColour.set(peakStress >= 0 ? stressColour(peakStress, palette) : palette.primary);
        state.maxPower = maxPower;
        state.anyLive = anyLive;
    }, [state, layout, store, lens, limits, palette]);

    return useMemo(() => ({ state, refresh }), [state, refresh]);
}

function Ground({ layout, palette, dark }: Readonly<{ layout: TwinLayout; palette: ScenePalette; dark: boolean }>) {
    const radius = layout.radius * 1.7;
    const gridSize = Math.round(radius * 1.4);
    return (
        <group>
            <mesh rotation-x={-Math.PI / 2} position-y={-0.02}>
                <circleGeometry args={[radius, 72]} />
                <meshStandardMaterial color={dark ? palette.surface : palette.surfaceAlt} roughness={0.95} metalness={0} />
            </mesh>
            <gridHelper args={[gridSize, Math.max(8, Math.round(gridSize / 1.5)), palette.primary, palette.primary]} position-y={0.002}>
                <lineBasicMaterial attach="material" vertexColors transparent opacity={dark ? 0.16 : 0.22} />
            </gridHelper>
            <mesh rotation-x={-Math.PI / 2} position-y={0.004}>
                <ringGeometry args={[Math.max(layout.width, layout.depth) * 0.72, Math.max(layout.width, layout.depth) * 0.75, 96]} />
                <meshBasicMaterial color={palette.primary} transparent opacity={dark ? 0.35 : 0.3} toneMapped={false} />
            </mesh>
        </group>
    );
}

type ShellCell = {
    floor: number;
    x: number;
    z: number;
    width: number;
    depth: number;
};

type SlabCell = {
    y: number;
    x: number;
    z: number;
    width: number;
    depth: number;
    top: boolean;
};

function floorCells(massing: TwinMassing): ShellCell[] {
    const cells: ShellCell[] = [];
    for (const block of massing.blocks) {
        for (let step = 0; step < block.floors; step += 1) {
            cells.push({
                floor: block.baseFloor + step,
                x: block.centreX,
                z: block.centreZ,
                width: block.width,
                depth: block.depth,
            });
        }
    }
    return cells;
}

function slabCells(massing: TwinMassing, floorHeight: number): SlabCell[] {
    const cells: SlabCell[] = [];
    for (const block of massing.blocks) {
        for (let level = 0; level <= block.floors; level += 1) {
            cells.push({
                y: (block.baseFloor + level) * floorHeight,
                x: block.centreX,
                z: block.centreZ,
                width: block.width,
                depth: block.depth,
                top: level === block.floors,
            });
        }
    }
    return cells;
}

function mullionCells(blocks: MassingBlock[], floorHeight: number): Array<[number, number, number, number]> {
    const posts: Array<[number, number, number, number]> = [];
    for (const block of blocks) {
        const halfWidth = block.width / 2;
        const halfDepth = block.depth / 2;
        const alongWidth = Math.max(2, Math.round(block.width / 2.1));
        const alongDepth = Math.max(2, Math.round(block.depth / 2.1));
        const base = block.baseFloor * floorHeight;
        const span = block.floors * floorHeight;
        for (let index = 0; index <= alongWidth; index += 1) {
            const x = block.centreX - halfWidth + (index * block.width) / alongWidth;
            posts.push([x, block.centreZ + halfDepth, base, span], [x, block.centreZ - halfDepth, base, span]);
        }
        for (let index = 1; index < alongDepth; index += 1) {
            const z = block.centreZ - halfDepth + (index * block.depth) / alongDepth;
            posts.push([block.centreX + halfWidth, z, base, span], [block.centreX - halfWidth, z, base, span]);
        }
    }
    return posts;
}

function topBlockOf(massing: TwinMassing): MassingBlock {
    return massing.blocks.reduce((highest, block) => (
        block.baseFloor + block.floors >= highest.baseFloor + highest.floors ? block : highest
    ), massing.blocks[0]);
}

function Roof({ layout, palette, dark }: Readonly<{ layout: TwinLayout; palette: ScenePalette; dark: boolean }>) {
    const { massing, floorHeight } = layout;
    const block = topBlockOf(massing);
    const crown = (block.baseFloor + block.floors) * floorHeight;
    const colour = dark ? palette.surfaceAlt : palette.surface;
    const bayWidth = block.width / Math.max(1, massing.bays);

    const gable = useMemo(() => {
        const shape = new THREE.Shape();
        const eaves = block.width / 2 + 0.2;
        shape.moveTo(-eaves, 0);
        shape.lineTo(eaves, 0);
        shape.lineTo(0, massing.roofRise);
        shape.closePath();
        return shape;
    }, [block.width, massing.roofRise]);

    const tooth = useMemo(() => {
        const shape = new THREE.Shape();
        shape.moveTo(0, 0);
        shape.lineTo(bayWidth, 0);
        shape.lineTo(bayWidth, massing.roofRise);
        shape.closePath();
        return shape;
    }, [bayWidth, massing.roofRise]);

    if (massing.roof === "pitched") {
        return (
            <mesh position={[block.centreX, crown, block.centreZ - block.depth / 2 - 0.2]}>
                <extrudeGeometry args={[gable, { depth: block.depth + 0.4, bevelEnabled: false }]} />
                <meshStandardMaterial color={colour} roughness={0.8} metalness={0.02} flatShading />
            </mesh>
        );
    }

    if (massing.roof === "vaulted") {
        const radius = block.depth / 2;
        //the arc keeps the full span of the plan but only lifts as far as the roof rise
        const squash = Math.max(0.08, massing.roofRise / radius);
        return (
            <mesh position={[block.centreX, crown, block.centreZ]} rotation-z={Math.PI / 2} scale={[squash, 1, 1]}>
                <cylinderGeometry args={[radius, radius, block.width, 24, 1, true, 0, Math.PI]} />
                <meshStandardMaterial color={colour} roughness={0.55} metalness={0.15} side={THREE.DoubleSide} />
            </mesh>
        );
    }

    if (massing.roof === "sawtooth") {
        return (
            <group position={[block.centreX - block.width / 2, crown, block.centreZ - block.depth / 2]}>
                {Array.from({ length: massing.bays }, (_, bay) => (
                    <group key={`bay-${bay}`} position={[bayWidth * bay, 0, 0]}>
                        <mesh>
                            <extrudeGeometry args={[tooth, { depth: block.depth, bevelEnabled: false }]} />
                            <meshStandardMaterial color={colour} roughness={0.85} metalness={0.02} flatShading />
                        </mesh>
                        <mesh position={[bayWidth - 0.02, massing.roofRise / 2, block.depth / 2]} rotation-y={Math.PI / 2}>
                            <planeGeometry args={[block.depth * 0.9, massing.roofRise * 0.86]} />
                            <meshBasicMaterial color={palette.primary} transparent opacity={dark ? 0.34 : 0.26} side={THREE.DoubleSide} toneMapped={false} />
                        </mesh>
                    </group>
                ))}
            </group>
        );
    }

    return null;
}

function BuildingShell({ layout, palette, dark }: Readonly<{ layout: TwinLayout; palette: ScenePalette; dark: boolean }>) {
    const { height, floorHeight, massing } = layout;
    const slabRef = useRef<THREE.InstancedMesh>(null);
    const mullionRef = useRef<THREE.InstancedMesh>(null);
    const slabColour = dark ? palette.surfaceAlt : palette.surface;
    const slabs = useMemo(() => slabCells(massing, floorHeight), [massing, floorHeight]);
    const mullions = useMemo(() => mullionCells(massing.blocks, floorHeight), [massing.blocks, floorHeight]);

    const outline = useMemo(() => {
        const merged = new THREE.BufferGeometry();
        const chunks: THREE.BufferGeometry[] = [];
        for (const block of massing.blocks) {
            const box = new THREE.BoxGeometry(block.width + 0.3, block.floors * floorHeight + 0.2, block.depth + 0.3);
            box.translate(block.centreX, (block.baseFloor + block.floors / 2) * floorHeight + 0.05, block.centreZ);
            const edges = new THREE.EdgesGeometry(box);
            box.dispose();
            chunks.push(edges);
        }
        const positions: number[] = [];
        for (const chunk of chunks) {
            const array = chunk.getAttribute("position").array;
            for (const value of array) {
                positions.push(value);
            }
            chunk.dispose();
        }
        merged.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
        return merged;
    }, [massing.blocks, floorHeight]);
    useEffect(() => () => outline.dispose(), [outline]);

    useLayoutEffect(() => {
        const slabMesh = slabRef.current;
        const posts = mullionRef.current;
        if (!slabMesh || !posts) {
            return;
        }
        slabs.forEach((cell, index) => {
            const thickness = cell.top ? 0.2 : 0.12;
            scratchMatrix.makeScale(cell.width + 0.3, thickness, cell.depth + 0.3).setPosition(cell.x, cell.y + thickness / 2, cell.z);
            slabMesh.setMatrixAt(index, scratchMatrix);
        });
        mullions.forEach(([x, z, base, span], index) => {
            scratchMatrix.makeScale(0.05, span, 0.05).setPosition(x, base + span / 2, z);
            posts.setMatrixAt(index, scratchMatrix);
        });
        slabMesh.instanceMatrix.needsUpdate = true;
        posts.instanceMatrix.needsUpdate = true;
    }, [slabs, mullions]);

    return (
        <group>
            <instancedMesh key={`slabs-${slabs.length}`} ref={slabRef} args={[undefined, undefined, slabs.length]} frustumCulled={false}>
                <boxGeometry />
                <meshStandardMaterial color={slabColour} roughness={0.7} metalness={0.05} />
            </instancedMesh>
            <instancedMesh key={`posts-${mullions.length}`} ref={mullionRef} args={[undefined, undefined, mullions.length]} frustumCulled={false}>
                <boxGeometry />
                <meshStandardMaterial color={palette.secondary} roughness={0.5} metalness={0.3} />
            </instancedMesh>
            <lineSegments geometry={outline}>
                <lineBasicMaterial color={palette.primary} transparent opacity={dark ? 0.55 : 0.45} />
            </lineSegments>
            <mesh position={[0, height / 2, 0]}>
                <cylinderGeometry args={[0.07, 0.07, height, 12]} />
                <meshBasicMaterial color={palette.primary} transparent opacity={0.55} toneMapped={false} />
            </mesh>
            <Roof layout={layout} palette={palette} dark={dark} />
        </group>
    );
}

function glassOpacity(facade: FacadeStyle, dark: boolean): number | null {
    if (facade === "frame") {
        return null;
    }
    if (facade === "punched") {
        return dark ? 0.09 : 0.11;
    }
    if (facade === "panel") {
        return dark ? 0.06 : 0.08;
    }
    return dark ? 0.12 : 0.14;
}

function FloorBands({
    layout,
    source,
    palette,
    dark,
    reducedMotion,
}: Readonly<{ layout: TwinLayout; source: VisualSource; palette: ScenePalette; dark: boolean; reducedMotion: boolean }>) {
    const { floorHeight, massing } = layout;
    const glassRef = useRef<THREE.InstancedMesh>(null);
    const bandRef = useRef<THREE.InstancedMesh>(null);
    const cells = useMemo(() => floorCells(massing), [massing]);
    const rims = useMemo(() => slabCells(massing, floorHeight), [massing, floorHeight]);
    const opacity = glassOpacity(massing.facade, dark);
    const shown = useMemo(() => ({
        bands: rims.map(() => new THREE.Color()),
        glass: cells.map(() => new THREE.Color()),
    }), [rims, cells]);
    const tones = useMemo(() => {
        const base = new THREE.Color(palette.primary);
        return {
            base,
            dim: base.clone().lerp(new THREE.Color(dark ? palette.background : "#ffffff"), 0.55),
            target: new THREE.Color(),
        };
    }, [palette.primary, palette.background, dark]);

    const rimFloor = useCallback((index: number) => {
        const rim = rims[index];
        return Math.max(0, Math.round(rim.y / floorHeight) - (rim.top ? 1 : 0));
    }, [rims, floorHeight]);

    useLayoutEffect(() => {
        const glass = glassRef.current;
        const bands = bandRef.current;
        if (!bands) {
            return;
        }
        cells.forEach((cell, index) => {
            if (!glass) {
                return;
            }
            scratchMatrix
                .makeScale(cell.width, floorHeight - 0.12, cell.depth)
                .setPosition(cell.x, cell.floor * floorHeight + (floorHeight + 0.12) / 2, cell.z);
            glass.setMatrixAt(index, scratchMatrix);
            glass.setColorAt(index, shown.glass[index].copy(tones.base));
        });
        rims.forEach((rim, index) => {
            scratchMatrix.makeScale(rim.width + 0.36, 0.06, rim.depth + 0.36).setPosition(rim.x, rim.y + (rim.top ? 0.1 : 0.06), rim.z);
            bands.setMatrixAt(index, scratchMatrix);
            bands.setColorAt(index, shown.bands[index].copy(tones.dim));
        });
        if (glass) {
            glass.instanceMatrix.needsUpdate = true;
            if (glass.instanceColor) glass.instanceColor.needsUpdate = true;
        }
        bands.instanceMatrix.needsUpdate = true;
        if (bands.instanceColor) bands.instanceColor.needsUpdate = true;
    }, [cells, rims, floorHeight, shown, tones]);

    useFrame((frame, delta) => {
        source.refresh(frame.clock.elapsedTime);
        const glass = glassRef.current;
        const bands = bandRef.current;
        if (!bands) {
            return;
        }
        const time = frame.clock.elapsedTime;
        const ease = reducedMotion ? 1 : 1 - Math.exp(-delta * 3);
        const { floorStress, floorColours } = source.state;
        let moving = false;

        rims.forEach((rim, index) => {
            const floor = rimFloor(index);
            const stress = floorStress[floor] ?? -1;
            if (stress >= 0) {
                const breath = reducedMotion ? 1 : 0.82 + 0.18 * Math.sin(time * (1.3 + stress * 4) + floor * 0.9);
                tones.target.copy(tones.dim).lerp(floorColours[floor], breath);
            } else {
                tones.target.copy(tones.dim);
            }
            moving = approachColour(shown.bands[index], tones.target, ease) || moving;
            bands.setColorAt(index, shown.bands[index]);
        });

        if (glass) {
            cells.forEach((cell, index) => {
                const stress = floorStress[cell.floor] ?? -1;
                tones.target.copy(tones.base);
                if (stress >= 0) {
                    tones.target.lerp(floorColours[cell.floor], 0.6);
                }
                moving = approachColour(shown.glass[index], tones.target, ease) || moving;
                glass.setColorAt(index, shown.glass[index]);
            });
            if (glass.instanceColor) glass.instanceColor.needsUpdate = true;
        }

        if (bands.instanceColor) bands.instanceColor.needsUpdate = true;
        if (moving) {
            frame.invalidate();
        }
    });

    return (
        <group>
            {opacity !== null && (
                <instancedMesh key={`glass-${cells.length}`} ref={glassRef} args={[undefined, undefined, cells.length]} frustumCulled={false} renderOrder={1}>
                    <boxGeometry />
                    <meshBasicMaterial transparent opacity={opacity} depthWrite={false} toneMapped={false} />
                </instancedMesh>
            )}
            <instancedMesh key={`bands-${rims.length}`} ref={bandRef} args={[undefined, undefined, rims.length]} frustumCulled={false}>
                <boxGeometry />
                <meshBasicMaterial toneMapped={false} />
            </instancedMesh>
        </group>
    );
}

function GridConnection({ layout, palette, dark }: Readonly<{ layout: TwinLayout; palette: ScenePalette; dark: boolean }>) {
    const [x, , z] = layout.incomer;
    const [sourceX, sourceY, sourceZ] = layout.gridSource;
    const cable = useMemo(() => {
        const curve = new THREE.QuadraticBezierCurve3(
            new THREE.Vector3(sourceX, sourceY, sourceZ),
            new THREE.Vector3((sourceX + x) / 2, sourceY - 0.9, (sourceZ + z) / 2),
            new THREE.Vector3(x, 1.9, z),
        );
        const geometry = new THREE.BufferGeometry().setFromPoints(curve.getPoints(24));
        const material = new THREE.LineBasicMaterial({ color: palette.idle, transparent: true, opacity: 0.7 });
        return new THREE.Line(geometry, material);
    }, [x, z, sourceX, sourceY, sourceZ, palette.idle]);
    useEffect(() => () => {
        cable.geometry.dispose();
        (cable.material as THREE.Material).dispose();
    }, [cable]);

    const housing = dark ? palette.surfaceAlt : palette.surface;
    return (
        <group>
            <mesh position={[x, 0.06, z]}>
                <boxGeometry args={[1.9, 0.12, 2.6]} />
                <meshStandardMaterial color={housing} roughness={0.8} />
            </mesh>
            <mesh position={[x - 0.25, 0.55, z]}>
                <boxGeometry args={[0.8, 0.86, 1.3]} />
                <meshStandardMaterial color={dark ? palette.secondary : palette.idle} roughness={0.45} metalness={0.4} />
            </mesh>
            <mesh position={[x, 1.55, z]}>
                <cylinderGeometry args={[0.03, 0.03, 0.7, 8]} />
                <meshStandardMaterial color={palette.idle} />
            </mesh>
            <mesh position={[sourceX, sourceY / 2, sourceZ]}>
                <cylinderGeometry args={[0.06, 0.09, sourceY, 8]} />
                <meshStandardMaterial color={dark ? palette.secondary : palette.idle} roughness={0.6} />
            </mesh>
            <mesh position={[sourceX, sourceY - 0.1, sourceZ]}>
                <boxGeometry args={[0.1, 0.08, 1.1]} />
                <meshStandardMaterial color={dark ? palette.secondary : palette.idle} />
            </mesh>
            <primitive object={cable} />
        </group>
    );
}

function SensorNodes({
    layout,
    source,
    dark,
    reducedMotion,
    selectedIndex,
    hoveredIndex,
    onHover,
    onSelect,
}: Readonly<{
    layout: TwinLayout;
    source: VisualSource;
    dark: boolean;
    reducedMotion: boolean;
    selectedIndex: number;
    hoveredIndex: number;
    onHover: (index: number) => void;
    onSelect: (sensorId: string | null) => void;
}>) {
    const count = layout.placements.length;
    const coreRef = useRef<THREE.InstancedMesh>(null);
    const shown = useMemo(() => layout.placements.map(() => new THREE.Color()), [layout]);
    const radii = useMemo(() => new Float32Array(count).fill(0.2), [count]);
    const phases = useMemo(() => Float32Array.from(layout.placements, (_, index) => (index * 2.399) % (Math.PI * 2)), [layout]);
    const halo = useMemo(() => {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.BufferAttribute(Float32Array.from(layout.placements.flatMap((placement) => placement.position)), 3));
        geometry.setAttribute("tint", new THREE.BufferAttribute(new Float32Array(count * 3), 3).setUsage(THREE.DynamicDrawUsage));
        geometry.setAttribute("size", new THREE.BufferAttribute(new Float32Array(count), 1).setUsage(THREE.DynamicDrawUsage));
        geometry.setAttribute("alpha", new THREE.BufferAttribute(new Float32Array(count), 1).setUsage(THREE.DynamicDrawUsage));
        return geometry;
    }, [layout, count]);
    useEffect(() => () => halo.dispose(), [halo]);
    const glow = useGlowMaterial(dark);

    useLayoutEffect(() => {
        const mesh = coreRef.current;
        if (!mesh) {
            return;
        }
        layout.placements.forEach((placement, index) => {
            scratchMatrix.makeScale(0.2, 0.2, 0.2).setPosition(...placement.position);
            mesh.setMatrixAt(index, scratchMatrix);
            mesh.setColorAt(index, shown[index].copy(source.state.visuals[index].colour));
        });
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

        const sphere = new THREE.Sphere();
        const hit = new THREE.Vector3();
        mesh.raycast = (raycaster, intersects) => {
            layout.placements.forEach((placement, index) => {
                sphere.center.set(...placement.position);
                sphere.radius = Math.max(radii[index], 0.2) * 1.4;
                if (raycaster.ray.intersectSphere(sphere, hit)) {
                    intersects.push({
                        distance: raycaster.ray.origin.distanceTo(hit),
                        point: hit.clone(),
                        object: mesh,
                        instanceId: index,
                    });
                }
            });
        };
    }, [layout, shown, radii, source]);

    useFrame((frame, delta) => {
        source.refresh(frame.clock.elapsedTime);
        const mesh = coreRef.current;
        if (!mesh) {
            return;
        }
        const time = frame.clock.elapsedTime;
        const ease = reducedMotion ? 1 : 1 - Math.exp(-delta * 5);
        const tint = halo.getAttribute("tint") as THREE.BufferAttribute;
        const size = halo.getAttribute("size") as THREE.BufferAttribute;
        const alpha = halo.getAttribute("alpha") as THREE.BufferAttribute;
        let moving = false;

        layout.placements.forEach((placement, index) => {
            const visual = source.state.visuals[index];
            const colour = shown[index];
            moving = approachColour(colour, visual.colour, ease) || moving;
            const gap = visual.radius - radii[index];
            radii[index] += gap * ease;
            moving = moving || Math.abs(gap) > 0.002;

            const stress = Math.max(visual.stress, 0);
            let pulse = 1;
            if (!reducedMotion && visual.live) {
                pulse = 1 + (0.05 + 0.13 * stress) * Math.sin(time * (1.8 + stress * 5) + phases[index]);
            } else if (!reducedMotion && visual.state === "waiting") {
                pulse = 1 + 0.04 * Math.sin(time * 1.2 + phases[index]);
            }
            let emphasis = 1;
            if (index === selectedIndex) {
                emphasis = 1.25;
            } else if (index === hoveredIndex) {
                emphasis = 1.12;
            }
            const radius = radii[index] * pulse * emphasis;

            scratchMatrix.makeScale(radius, radius, radius).setPosition(...placement.position);
            mesh.setMatrixAt(index, scratchMatrix);
            mesh.setColorAt(index, colour);
            tint.setXYZ(index, colour.r, colour.g, colour.b);
            size.setX(index, radius * (visual.live ? 6.2 + stress * 3 : 3.6));
            let glowAlpha = 0.24;
            if (visual.live) {
                glowAlpha = (dark ? 0.72 : 0.68) + stress * 0.25;
            }
            alpha.setX(index, glowAlpha);
        });

        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        tint.needsUpdate = true;
        size.needsUpdate = true;
        alpha.needsUpdate = true;
        if (moving) {
            frame.invalidate();
        }
    });

    return (
        <group>
            <instancedMesh
                key={`sensors-${count}`}
                ref={coreRef}
                args={[undefined, undefined, count]}
                frustumCulled={false}
                onPointerMove={(event: ThreeEvent<PointerEvent>) => {
                    event.stopPropagation();
                    if (event.instanceId !== undefined && event.instanceId !== hoveredIndex) {
                        onHover(event.instanceId);
                    }
                }}
                onPointerOut={() => onHover(-1)}
                onClick={(event: ThreeEvent<MouseEvent>) => {
                    event.stopPropagation();
                    if (event.instanceId !== undefined) {
                        onSelect(layout.placements[event.instanceId].sensor.sensor_id);
                    }
                }}
            >
                <sphereGeometry args={[1, 24, 16]} />
                <meshBasicMaterial toneMapped={false} />
            </instancedMesh>
            <points geometry={halo} material={glow} frustumCulled={false} renderOrder={2} />
        </group>
    );
}

function EnergyFlows({
    layout,
    source,
    palette,
    dark,
    reducedMotion,
    lowQuality,
}: Readonly<{
    layout: TwinLayout;
    source: VisualSource;
    palette: ScenePalette;
    dark: boolean;
    reducedMotion: boolean;
    lowQuality: boolean;
}>) {
    const paths = useMemo(() => layout.flows.map((flow) => ({
        path: measurePath(flow.points),
        driver: flow.driver === null ? -1 : layout.placements.findIndex((placement) => placement.sensor.sensor_id === flow.driver),
    })), [layout]);

    const plan = useMemo(() => {
        const budget = lowQuality ? 500 : 1400;
        const wanted = paths.map(({ path }) => Math.min(16, Math.max(3, Math.round(path.length / 0.8))));
        const total = wanted.reduce((sum, value) => sum + value, 0);
        const factor = total > budget ? budget / total : 1;
        const owners: number[] = [];
        const progress: number[] = [];
        wanted.forEach((value, pathIndex) => {
            const particles = Math.max(1, Math.floor(value * factor));
            for (let index = 0; index < particles; index += 1) {
                owners.push(pathIndex);
                progress.push(index / particles);
            }
        });
        return { owners: Int32Array.from(owners), progress: Float32Array.from(progress) };
    }, [paths, lowQuality]);

    const particles = useMemo(() => {
        const total = plan.owners.length;
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(total * 3), 3).setUsage(THREE.DynamicDrawUsage));
        geometry.setAttribute("tint", new THREE.BufferAttribute(new Float32Array(total * 3), 3).setUsage(THREE.DynamicDrawUsage));
        geometry.setAttribute("size", new THREE.BufferAttribute(new Float32Array(total), 1).setUsage(THREE.DynamicDrawUsage));
        geometry.setAttribute("alpha", new THREE.BufferAttribute(new Float32Array(total), 1).setUsage(THREE.DynamicDrawUsage));
        return geometry;
    }, [plan]);
    useEffect(() => () => particles.dispose(), [particles]);

    const cables = useMemo(() => {
        const points: THREE.Vector3[] = [];
        paths.forEach(({ path }) => {
            for (let index = 1; index < path.points.length; index += 1) {
                points.push(new THREE.Vector3(...path.points[index - 1]), new THREE.Vector3(...path.points[index]));
            }
        });
        return new THREE.BufferGeometry().setFromPoints(points);
    }, [paths]);
    useEffect(() => () => cables.dispose(), [cables]);

    const glow = useGlowMaterial(dark);

    useFrame((frame, delta) => {
        source.refresh(frame.clock.elapsedTime);
        const { owners, progress } = plan;
        const state = source.state;
        const position = particles.getAttribute("position") as THREE.BufferAttribute;
        const tint = particles.getAttribute("tint") as THREE.BufferAttribute;
        const size = particles.getAttribute("size") as THREE.BufferAttribute;
        const alpha = particles.getAttribute("alpha") as THREE.BufferAttribute;
        const positions = position.array as Float32Array;
        const step = Math.min(delta, 0.1);

        for (let index = 0; index < owners.length; index += 1) {
            const { path, driver } = paths[owners[index]];
            const visual = driver >= 0 ? state.visuals[driver] : null;
            const live = visual ? visual.live : state.anyLive;
            let share = state.anyLive ? 0.7 : 0;
            if (visual) {
                share = state.maxPower > 0 ? visual.power / state.maxPower : 0;
            }
            const colour = visual ? visual.colour : state.aggregateColour;

            if (live && !reducedMotion && path.length > 0) {
                progress[index] = (progress[index] + (step * (0.9 + 2.6 * share)) / path.length) % 1;
            }
            writePointAlongPath(path, progress[index], positions, index * 3);
            tint.setXYZ(index, colour.r, colour.g, colour.b);
            size.setX(index, live ? 0.26 + 0.2 * share : 0);
            const fade = Math.sqrt(Math.max(0, Math.sin(progress[index] * Math.PI)));
            alpha.setX(index, live ? (dark ? 0.95 : 0.8) * fade : 0);
        }

        position.needsUpdate = true;
        tint.needsUpdate = true;
        size.needsUpdate = true;
        alpha.needsUpdate = true;
    });

    return (
        <group>
            <lineSegments geometry={cables}>
                <lineBasicMaterial color={palette.primary} transparent opacity={dark ? 0.3 : 0.38} />
            </lineSegments>
            <points geometry={particles} material={glow} frustumCulled={false} renderOrder={3} />
        </group>
    );
}

function SensorTag({
    placement,
    store,
    lens,
    limits,
    selected,
}: Readonly<{ placement: SensorPlacement; store: ReadingStore; lens: LoadLens; limits: TwinLimits; selected: boolean }>) {
    const read = useCallback(() => {
        const view = describeSensor(placement.sensor, store.get(placement.sensor.sensor_id), lens, limits, Date.now());
        return view.state === "live" ? formatKw(view.powerKw) : TAG_TEXT[view.state];
    }, [placement, store, lens, limits]);
    const [text, setText] = useState(read);
    const elapsed = useRef(0);

    useEffect(() => {
        setText(read());
    }, [read]);

    useFrame((_, delta) => {
        elapsed.current += delta;
        if (elapsed.current < 0.5) {
            return;
        }
        elapsed.current = 0;
        const next = read();
        setText((current) => (current === next ? current : next));
    });

    const [x, y, z] = placement.position;
    return (
        <Html
            position={[x, y + 0.8, z]}
            center
            zIndexRange={[20, 0]}
            pointerEvents="none"
            className={selected ? "twin-tag twin-tag-selected" : "twin-tag"}
        >
            <span className="twin-tag-name">{sensorLabel(placement.sensor)}</span>
            <span className="twin-tag-value">{text}</span>
        </Html>
    );
}

function SelectionRing({ placement, colour, reducedMotion }: Readonly<{ placement: SensorPlacement; colour: string; reducedMotion: boolean }>) {
    const ref = useRef<THREE.Mesh>(null);
    useFrame((frame, delta) => {
        if (ref.current && !reducedMotion) {
            ref.current.rotation.z += delta * 0.9;
            frame.invalidate();
        }
    });
    return (
        <mesh ref={ref} position={placement.position} rotation-x={-Math.PI / 2}>
            <torusGeometry args={[0.72, 0.03, 8, 48, Math.PI * 1.5]} />
            <meshBasicMaterial color={colour} toneMapped={false} />
        </mesh>
    );
}

function CameraRig({
    framing,
    focus,
    resetToken,
    reducedMotion,
}: Readonly<{ framing: CameraFraming; focus: SensorPlacement | null; resetToken: number; reducedMotion: boolean }>) {
    const controls = useRef<ControlsHandle>(null);
    const camera = useThree((state) => state.camera);
    const invalidate = useThree((state) => state.invalidate);
    const flight = useRef<{ fromTarget: THREE.Vector3; toTarget: THREE.Vector3; fromPosition: THREE.Vector3; toPosition: THREE.Vector3; progress: number } | null>(null);
    const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [spinning, setSpinning] = useState(!reducedMotion);

    const flyTo = useCallback((target: THREE.Vector3, position: THREE.Vector3) => {
        const orbit = controls.current;
        if (!orbit) {
            return;
        }
        if (reducedMotion) {
            orbit.target.copy(target);
            camera.position.copy(position);
            orbit.update();
            invalidate();
            return;
        }
        flight.current = {
            fromTarget: orbit.target.clone(),
            toTarget: target,
            fromPosition: camera.position.clone(),
            toPosition: position,
            progress: 0,
        };
        invalidate();
    }, [camera, invalidate, reducedMotion]);

    useEffect(() => {
        const orbit = controls.current;
        camera.position.set(...framing.position);
        orbit?.target.set(...framing.target);
        orbit?.update();
        invalidate();
    }, [framing, camera, invalidate]);

    useEffect(() => {
        if (resetToken > 0) {
            flyTo(new THREE.Vector3(...framing.target), new THREE.Vector3(...framing.position));
        }
    }, [resetToken, framing, flyTo]);

    const focusKey = focus ? focus.sensor.sensor_id : null;
    const [focusX, focusY, focusZ] = focus ? focus.position : [0, 0, 0];
    const focusDistance = Math.max(framing.minDistance * 1.35, framing.maxDistance * 0.34);
    useEffect(() => {
        const orbit = controls.current;
        if (focusKey === null || !orbit) {
            return;
        }
        const target = new THREE.Vector3(focusX, focusY, focusZ);
        const offset = camera.position.clone().sub(orbit.target).setLength(focusDistance);
        flyTo(target, target.clone().add(offset));
    }, [focusKey, focusX, focusY, focusZ, focusDistance, camera, flyTo]);

    useEffect(() => () => {
        if (idleTimer.current) {
            clearTimeout(idleTimer.current);
        }
    }, []);

    useFrame((frame, delta) => {
        const orbit = controls.current;
        const active = flight.current;
        if (!orbit || !active) {
            return;
        }
        active.progress = Math.min(1, active.progress + delta / 0.9);
        const t = active.progress;
        const eased = t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
        orbit.target.lerpVectors(active.fromTarget, active.toTarget, eased);
        camera.position.lerpVectors(active.fromPosition, active.toPosition, eased);
        orbit.update();
        if (t >= 1) {
            flight.current = null;
        } else {
            frame.invalidate();
        }
    });

    return (
        <OrbitControls
            ref={controls}
            makeDefault
            enableDamping
            dampingFactor={0.08}
            minDistance={framing.minDistance}
            maxDistance={framing.maxDistance}
            maxPolarAngle={Math.PI * 0.47}
            autoRotate={spinning && !reducedMotion && focus === null}
            autoRotateSpeed={0.45}
            onStart={() => {
                flight.current = null;
                setSpinning(false);
                if (idleTimer.current) {
                    clearTimeout(idleTimer.current);
                }
            }}
            onEnd={() => {
                if (!reducedMotion) {
                    idleTimer.current = setTimeout(() => setSpinning(true), 12000);
                }
            }}
        />
    );
}

function StoreInvalidator({ store }: Readonly<{ store: ReadingStore }>) {
    const invalidate = useThree((state) => state.invalidate);
    useEffect(() => store.subscribe(() => invalidate()), [store, invalidate]);
    useEffect(() => {
        const timer = setInterval(() => invalidate(), 1000);
        return () => clearInterval(timer);
    }, [invalidate]);
    return null;
}

function SceneContents({
    layout,
    store,
    lens,
    limits,
    palette,
    dark,
    selectedId,
    onSelect,
    reducedMotion,
    resetToken,
    framing,
    lowQuality,
    solarPanels = 0,
}: Readonly<Omit<TwinSceneProps, "active" | "onContextLost"> & { framing: CameraFraming; lowQuality: boolean }>) {
    const source = useVisualSource(layout, store, lens, limits, palette);
    const [hoveredIndex, setHoveredIndex] = useState(-1);
    const gl = useThree((state) => state.gl);

    const selectedIndex = selectedId === null
        ? -1
        : layout.placements.findIndex((placement) => placement.sensor.sensor_id === selectedId);
    const selectedPlacement = selectedIndex >= 0 ? layout.placements[selectedIndex] : null;
    const hoveredPlacement = hoveredIndex >= 0 && hoveredIndex !== selectedIndex ? layout.placements[hoveredIndex] ?? null : null;

    useEffect(() => {
        gl.domElement.style.cursor = hoveredIndex >= 0 ? "pointer" : "";
    }, [gl, hoveredIndex]);

    useEffect(() => {
        setHoveredIndex(-1);
    }, [layout]);

    const fogNear = layout.radius * 2.2;
    const fogFar = layout.radius * 6;

    return (
        <>
            <fog attach="fog" args={[palette.background, fogNear, fogFar]} />
            <hemisphereLight color={dark ? palette.primary : "#ffffff"} groundColor={dark ? palette.background : palette.surfaceAlt} intensity={dark ? 0.7 : 1.15} />
            <directionalLight position={[14, 22, 12]} intensity={dark ? 1.1 : 1.6} />
            <directionalLight position={[-12, 10, -10]} intensity={dark ? 0.35 : 0.55} />
            <StoreInvalidator store={store} />
            <Ground layout={layout} palette={palette} dark={dark} />
            <BuildingShell layout={layout} palette={palette} dark={dark} />
            <BuildingDetail layout={layout} palette={palette} dark={dark} solarPanels={solarPanels} />
            <FloorBands layout={layout} source={source} palette={palette} dark={dark} reducedMotion={reducedMotion} />
            <GridConnection layout={layout} palette={palette} dark={dark} />
            <EnergyFlows layout={layout} source={source} palette={palette} dark={dark} reducedMotion={reducedMotion} lowQuality={lowQuality} />
            {layout.placements.length > 0 && (
                <SensorNodes
                    layout={layout}
                    source={source}
                    dark={dark}
                    reducedMotion={reducedMotion}
                    selectedIndex={selectedIndex}
                    hoveredIndex={hoveredIndex}
                    onHover={setHoveredIndex}
                    onSelect={onSelect}
                />
            )}
            {selectedPlacement && (
                <>
                    <SelectionRing placement={selectedPlacement} colour={palette.primary} reducedMotion={reducedMotion} />
                    <SensorTag placement={selectedPlacement} store={store} lens={lens} limits={limits} selected />
                </>
            )}
            {hoveredPlacement && (
                <SensorTag placement={hoveredPlacement} store={store} lens={lens} limits={limits} selected={false} />
            )}
            <CameraRig framing={framing} focus={selectedPlacement} resetToken={resetToken} reducedMotion={reducedMotion} />
        </>
    );
}

function TwinScene(props: Readonly<TwinSceneProps>) {
    const { layout, active, reducedMotion, onContextLost, onSelect } = props;
    const framing = useMemo(() => cameraFraming(layout, FOV), [layout]);
    const maxDpr = useMemo(() => Math.min(globalThis.devicePixelRatio || 1, 1.75), []);
    const [dpr, setDpr] = useState(maxDpr);
    const [lowQuality, setLowQuality] = useState(false);
    const lostRef = useRef(onContextLost);

    useEffect(() => {
        lostRef.current = onContextLost;
    }, [onContextLost]);

    let frameloop: "always" | "demand" | "never" = "always";
    if (!active) {
        frameloop = "never";
    } else if (reducedMotion) {
        frameloop = "demand";
    }

    return (
        <Canvas
            className="twin-canvas"
            flat
            frameloop={frameloop}
            dpr={dpr}
            camera={{ position: framing.position, fov: FOV, near: 0.1, far: 500 }}
            gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
            onCreated={({ gl }) => {
                gl.domElement.addEventListener("webglcontextlost", (event) => {
                    event.preventDefault();
                    lostRef.current();
                }, { once: true });
            }}
            onPointerMissed={() => onSelect(null)}
        >
            <PerformanceMonitor
                flipflops={3}
                onDecline={() => setDpr(1)}
                onIncline={() => setDpr(maxDpr)}
                onFallback={() => {
                    setDpr(1);
                    setLowQuality(true);
                }}
            />
            <SceneContents {...props} framing={framing} lowQuality={lowQuality} />
        </Canvas>
    );
}

export default memo(TwinScene);