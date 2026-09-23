"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { MassingBlock, TwinLayout } from "@/lib/digitalTwin";
import type { ScenePalette } from "./TwinScene";

const scratch = new THREE.Matrix4();
const scratchQuat = new THREE.Quaternion();
const scratchPos = new THREE.Vector3();
const scratchScale = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

type Face = {
    normalX: number;
    normalZ: number;
    spanX: number;
    spanZ: number;
    rotation: number;
};

function facesOf(block: MassingBlock): Face[] {
    const halfWidth = block.width / 2;
    const halfDepth = block.depth / 2;
    return [
        { normalX: 0, normalZ: halfDepth, spanX: block.width, spanZ: 0, rotation: 0 },
        { normalX: 0, normalZ: -halfDepth, spanX: block.width, spanZ: 0, rotation: Math.PI },
        { normalX: halfWidth, normalZ: 0, spanX: 0, spanZ: block.depth, rotation: Math.PI / 2 },
        { normalX: -halfWidth, normalZ: 0, spanX: 0, spanZ: block.depth, rotation: -Math.PI / 2 },
    ];
}

function place(mesh: THREE.InstancedMesh, index: number, x: number, y: number, z: number, sx: number, sy: number, sz: number, spin = 0) {
    scratchQuat.setFromAxisAngle(UP, spin);
    scratchPos.set(x, y, z);
    scratchScale.set(sx, sy, sz);
    scratch.compose(scratchPos, scratchQuat, scratchScale);
    mesh.setMatrixAt(index, scratch);
}

type WindowCell = {
    x: number;
    y: number;
    z: number;
    spin: number;
    width: number;
    height: number;
};

function windowCells(blocks: MassingBlock[], floorHeight: number, spacing: number): WindowCell[] {
    const cells: WindowCell[] = [];
    const paneHeight = Math.min(0.62, floorHeight * 0.5);
    for (const block of blocks) {
        for (const face of facesOf(block)) {
            const run = face.spanX || face.spanZ;
            const count = Math.max(2, Math.round(run / spacing));
            const paneWidth = Math.min(0.72, (run / count) * 0.62);
            for (let floor = 0; floor < block.floors; floor += 1) {
                const y = (block.baseFloor + floor) * floorHeight + floorHeight * 0.55;
                for (let slot = 0; slot < count; slot += 1) {
                    const offset = -run / 2 + (run / count) * (slot + 0.5);
                    cells.push({
                        x: block.centreX + face.normalX * 1.01 + (face.spanX ? offset : 0),
                        y,
                        z: block.centreZ + face.normalZ * 1.01 + (face.spanZ ? offset : 0),
                        spin: face.rotation,
                        width: paneWidth,
                        height: paneHeight,
                    });
                }
            }
        }
    }
    return cells;
}

function Windows({ layout, palette, dark }: Readonly<{ layout: TwinLayout; palette: ScenePalette; dark: boolean }>) {
    const meshRef = useRef<THREE.InstancedMesh>(null);
    const cells = useMemo(
        () => windowCells(layout.massing.blocks, layout.floorHeight, layout.massing.detail.windowSpacing),
        [layout.massing.blocks, layout.floorHeight, layout.massing.detail.windowSpacing],
    );

    useLayoutEffect(() => {
        const mesh = meshRef.current;
        if (!mesh) {
            return;
        }
        cells.forEach((cell, index) => {
            place(mesh, index, cell.x, cell.y, cell.z, cell.width, cell.height, 0.06, cell.spin);
        });
        mesh.instanceMatrix.needsUpdate = true;
    }, [cells]);

    if (cells.length === 0) {
        return null;
    }

    return (
        <instancedMesh key={`windows-${cells.length}`} ref={meshRef} args={[undefined, undefined, cells.length]} frustumCulled={false}>
            <boxGeometry />
            <meshStandardMaterial
                color={dark ? palette.background : palette.primary}
                roughness={0.18}
                metalness={0.45}
                transparent
                opacity={dark ? 0.75 : 0.42}
            />
        </instancedMesh>
    );
}

function Balconies({ layout, palette, dark }: Readonly<{ layout: TwinLayout; palette: ScenePalette; dark: boolean }>) {
    const slabRef = useRef<THREE.InstancedMesh>(null);
    const railRef = useRef<THREE.InstancedMesh>(null);
    const cells = useMemo(() => {
        const found: WindowCell[] = [];
        for (const block of layout.massing.blocks) {
            for (const face of facesOf(block)) {
                const run = face.spanX || face.spanZ;
                const count = Math.max(1, Math.round(run / 3.4));
                for (let floor = 1; floor < block.floors; floor += 1) {
                    const y = (block.baseFloor + floor) * layout.floorHeight;
                    for (let slot = 0; slot < count; slot += 1) {
                        const offset = -run / 2 + (run / count) * (slot + 0.5);
                        found.push({
                            x: block.centreX + face.normalX * 1.16 + (face.spanX ? offset : 0),
                            y,
                            z: block.centreZ + face.normalZ * 1.16 + (face.spanZ ? offset : 0),
                            spin: face.rotation,
                            width: Math.min(1.5, (run / count) * 0.56),
                            height: 0.08,
                        });
                    }
                }
            }
        }
        return found;
    }, [layout.massing.blocks, layout.floorHeight]);

    useLayoutEffect(() => {
        const slabs = slabRef.current;
        const rails = railRef.current;
        if (!slabs || !rails) {
            return;
        }
        cells.forEach((cell, index) => {
            place(slabs, index, cell.x, cell.y + 0.05, cell.z, cell.width, cell.height, 0.52, cell.spin);
            place(rails, index, cell.x, cell.y + 0.28, cell.z, cell.width, 0.4, 0.04, cell.spin);
        });
        slabs.instanceMatrix.needsUpdate = true;
        rails.instanceMatrix.needsUpdate = true;
    }, [cells]);

    if (cells.length === 0) {
        return null;
    }

    return (
        <group>
            <instancedMesh key={`balcony-${cells.length}`} ref={slabRef} args={[undefined, undefined, cells.length]} frustumCulled={false}>
                <boxGeometry />
                <meshStandardMaterial color={dark ? palette.surfaceAlt : palette.surface} roughness={0.75} />
            </instancedMesh>
            <instancedMesh key={`rail-${cells.length}`} ref={railRef} args={[undefined, undefined, cells.length]} frustumCulled={false}>
                <boxGeometry />
                <meshStandardMaterial color={palette.secondary} roughness={0.35} metalness={0.4} transparent opacity={0.65} />
            </instancedMesh>
        </group>
    );
}

function Fins({ layout, palette }: Readonly<{ layout: TwinLayout; palette: ScenePalette }>) {
    const meshRef = useRef<THREE.InstancedMesh>(null);
    const cells = useMemo(() => {
        const found: Array<{ x: number; z: number; base: number; span: number; spin: number }> = [];
        for (const block of layout.massing.blocks) {
            for (const face of facesOf(block)) {
                const run = face.spanX || face.spanZ;
                const count = Math.max(2, Math.round(run / 1.7));
                for (let slot = 0; slot <= count; slot += 1) {
                    const offset = -run / 2 + (run / count) * slot;
                    found.push({
                        x: block.centreX + face.normalX * 1.04 + (face.spanX ? offset : 0),
                        z: block.centreZ + face.normalZ * 1.04 + (face.spanZ ? offset : 0),
                        base: block.baseFloor * layout.floorHeight,
                        span: block.floors * layout.floorHeight,
                        spin: face.rotation,
                    });
                }
            }
        }
        return found;
    }, [layout.massing.blocks, layout.floorHeight]);

    useLayoutEffect(() => {
        const mesh = meshRef.current;
        if (!mesh) {
            return;
        }
        cells.forEach((cell, index) => {
            place(mesh, index, cell.x, cell.base + cell.span / 2, cell.z, 0.06, cell.span, 0.22, cell.spin);
        });
        mesh.instanceMatrix.needsUpdate = true;
    }, [cells]);

    if (cells.length === 0) {
        return null;
    }

    return (
        <instancedMesh key={`fins-${cells.length}`} ref={meshRef} args={[undefined, undefined, cells.length]} frustumCulled={false}>
            <boxGeometry />
            <meshStandardMaterial color={palette.secondary} roughness={0.4} metalness={0.35} />
        </instancedMesh>
    );
}

function Parapet({ layout, palette, dark }: Readonly<{ layout: TwinLayout; palette: ScenePalette; dark: boolean }>) {
    const meshRef = useRef<THREE.InstancedMesh>(null);
    const cells = useMemo(() => {
        const found: Array<{ x: number; y: number; z: number; sx: number; sz: number }> = [];
        for (const block of layout.massing.blocks) {
            const top = (block.baseFloor + block.floors) * layout.floorHeight;
            const halfWidth = block.width / 2 + 0.16;
            const halfDepth = block.depth / 2 + 0.16;
            found.push(
                { x: block.centreX, y: top + 0.24, z: block.centreZ + halfDepth, sx: block.width + 0.4, sz: 0.1 },
                { x: block.centreX, y: top + 0.24, z: block.centreZ - halfDepth, sx: block.width + 0.4, sz: 0.1 },
                { x: block.centreX + halfWidth, y: top + 0.24, z: block.centreZ, sx: 0.1, sz: block.depth + 0.4 },
                { x: block.centreX - halfWidth, y: top + 0.24, z: block.centreZ, sx: 0.1, sz: block.depth + 0.4 },
            );
        }
        return found;
    }, [layout.massing.blocks, layout.floorHeight]);

    useLayoutEffect(() => {
        const mesh = meshRef.current;
        if (!mesh) {
            return;
        }
        cells.forEach((cell, index) => {
            place(mesh, index, cell.x, cell.y, cell.z, cell.sx, 0.42, cell.sz);
        });
        mesh.instanceMatrix.needsUpdate = true;
    }, [cells]);

    return (
        <instancedMesh key={`parapet-${cells.length}`} ref={meshRef} args={[undefined, undefined, cells.length]} frustumCulled={false}>
            <boxGeometry />
            <meshStandardMaterial color={dark ? palette.surfaceAlt : palette.surface} roughness={0.8} />
        </instancedMesh>
    );
}

function Entrance({ layout, palette, dark }: Readonly<{ layout: TwinLayout; palette: ScenePalette; dark: boolean }>) {
    const { massing, floorHeight } = layout;
    const ground = massing.blocks.reduce((widest, block) => (block.baseFloor === 0 && block.depth > widest.depth ? block : widest), massing.blocks[0]);
    const faceZ = ground.centreZ + ground.depth / 2;
    const style = massing.detail.entrance;
    const panel = dark ? palette.background : palette.primary;

    if (style === "none") {
        return null;
    }

    if (style === "dock") {
        const bays = Math.max(1, massing.detail.docks);
        const spread = ground.width * 0.72;
        return (
            <group>
                <mesh position={[ground.centreX, 0.3, faceZ + 0.55]}>
                    <boxGeometry args={[spread + 1.2, 0.6, 1.1]} />
                    <meshStandardMaterial color={dark ? palette.surfaceAlt : palette.surface} roughness={0.9} />
                </mesh>
                {Array.from({ length: bays }, (_, bay) => {
                    const x = ground.centreX - spread / 2 + (spread / Math.max(1, bays - 1 || 1)) * (bays === 1 ? 0.5 : bay);
                    return (
                        <mesh key={`dock-${bay}`} position={[x, floorHeight * 0.42, faceZ + 0.03]}>
                            <boxGeometry args={[Math.min(1.5, spread / bays * 0.7), floorHeight * 0.82, 0.08]} />
                            <meshStandardMaterial color={palette.secondary} roughness={0.55} metalness={0.25} />
                        </mesh>
                    );
                })}
            </group>
        );
    }

    if (style === "shopfront") {
        return (
            <group>
                <mesh position={[ground.centreX, floorHeight * 0.45, faceZ + 0.04]}>
                    <boxGeometry args={[ground.width * 0.86, floorHeight * 0.8, 0.1]} />
                    <meshStandardMaterial color={panel} roughness={0.15} metalness={0.5} transparent opacity={dark ? 0.7 : 0.4} />
                </mesh>
                <mesh position={[ground.centreX, floorHeight * 0.95, faceZ + 0.9]}>
                    <boxGeometry args={[ground.width * 0.94, 0.12, 1.8]} />
                    <meshStandardMaterial color={palette.secondary} roughness={0.5} metalness={0.3} />
                </mesh>
            </group>
        );
    }

    const canopyWidth = Math.min(ground.width * 0.46, 4.2);
    return (
        <group>
            <mesh position={[ground.centreX, floorHeight * 0.38, faceZ + 0.04]}>
                <boxGeometry args={[canopyWidth * 0.72, floorHeight * 0.72, 0.1]} />
                <meshStandardMaterial color={panel} roughness={0.14} metalness={0.5} transparent opacity={dark ? 0.72 : 0.42} />
            </mesh>
            <mesh position={[ground.centreX, floorHeight * 0.86, faceZ + 0.75]}>
                <boxGeometry args={[canopyWidth, 0.12, 1.5]} />
                <meshStandardMaterial color={palette.secondary} roughness={0.45} metalness={0.35} />
            </mesh>
            <mesh position={[ground.centreX - canopyWidth / 2 + 0.12, floorHeight * 0.43, faceZ + 1.42]}>
                <cylinderGeometry args={[0.05, 0.05, floorHeight * 0.86, 8]} />
                <meshStandardMaterial color={palette.secondary} roughness={0.5} metalness={0.4} />
            </mesh>
            <mesh position={[ground.centreX + canopyWidth / 2 - 0.12, floorHeight * 0.43, faceZ + 1.42]}>
                <cylinderGeometry args={[0.05, 0.05, floorHeight * 0.86, 8]} />
                <meshStandardMaterial color={palette.secondary} roughness={0.5} metalness={0.4} />
            </mesh>
            <mesh position={[ground.centreX, 0.02, faceZ + 1.1]} rotation-x={-Math.PI / 2}>
                <planeGeometry args={[canopyWidth * 1.15, 2.4]} />
                <meshStandardMaterial color={dark ? palette.surfaceAlt : palette.surface} roughness={0.95} />
            </mesh>
        </group>
    );
}

function RoofEquipment({ layout, palette, dark, solarPanels }: Readonly<{ layout: TwinLayout; palette: ScenePalette; dark: boolean; solarPanels: number }>) {
    const { massing, floorHeight } = layout;
    const detail = massing.detail;
    const block = massing.blocks.reduce((highest, item) => (
        item.baseFloor + item.floors >= highest.baseFloor + highest.floors ? item : highest
    ), massing.blocks[0]);
    const top = (block.baseFloor + block.floors) * floorHeight + 0.2;
    const shell = dark ? palette.surfaceAlt : palette.surface;
    const flatTop = massing.roof === "flat";
    const units = flatTop ? Math.min(detail.plantUnits, 4) : 0;

    const panels = useMemo(() => {
        if (solarPanels <= 0) {
            return [];
        }
        const columns = Math.max(1, Math.round(Math.sqrt(solarPanels * (block.width / Math.max(0.1, block.depth)))));
        const rows = Math.max(1, Math.ceil(solarPanels / columns));
        const cellWidth = (block.width * 0.66) / columns;
        const cellDepth = (block.depth * 0.5) / rows;
        const found: Array<[number, number]> = [];
        for (let index = 0; index < solarPanels; index += 1) {
            const column = index % columns;
            const row = Math.floor(index / columns);
            found.push([
                block.centreX - (block.width * 0.33) + cellWidth * (column + 0.5),
                block.centreZ + (block.depth * 0.06) + cellDepth * (row + 0.5) - (block.depth * 0.25),
            ]);
        }
        return found.map(([x, z]) => ({ x, z, width: cellWidth * 0.86, depth: cellDepth * 0.72 }));
    }, [solarPanels, block.width, block.depth, block.centreX, block.centreZ]);

    return (
        <group>
            {Array.from({ length: units }, (_, unit) => {
                const across = block.width * (0.16 + unit * 0.14) - block.width * 0.3;
                return (
                    <group key={`plant-${unit}`} position={[block.centreX + across, top, block.centreZ - block.depth * 0.2]}>
                        <mesh position={[0, 0.22, 0]}>
                            <boxGeometry args={[Math.min(1.4, block.width * 0.16), 0.44, Math.min(1.2, block.depth * 0.18)]} />
                            <meshStandardMaterial color={shell} roughness={0.65} metalness={0.15} />
                        </mesh>
                        <mesh position={[0, 0.48, 0]} rotation-x={-Math.PI / 2}>
                            <ringGeometry args={[0.1, Math.min(0.34, block.width * 0.05), 14]} />
                            <meshStandardMaterial color={palette.secondary} roughness={0.4} metalness={0.5} side={THREE.DoubleSide} />
                        </mesh>
                    </group>
                );
            })}

            {flatTop && detail.tank && (
                <group position={[block.centreX + block.width * 0.3, top, block.centreZ + block.depth * 0.26]}>
                    <mesh position={[0, 0.62, 0]}>
                        <cylinderGeometry args={[Math.min(0.5, block.width * 0.07), Math.min(0.5, block.width * 0.07), 0.7, 14]} />
                        <meshStandardMaterial color={shell} roughness={0.5} metalness={0.25} />
                    </mesh>
                    <mesh position={[0, 0.14, 0]}>
                        <boxGeometry args={[0.1, 0.28, 0.1]} />
                        <meshStandardMaterial color={palette.secondary} roughness={0.6} />
                    </mesh>
                    <mesh position={[0.22, 0.14, 0.22]}>
                        <boxGeometry args={[0.08, 0.28, 0.08]} />
                        <meshStandardMaterial color={palette.secondary} roughness={0.6} />
                    </mesh>
                </group>
            )}

            {flatTop && detail.liftOverrun && (
                <mesh position={[block.centreX - block.width * 0.26, top + floorHeight * 0.34, block.centreZ + block.depth * 0.22]}>
                    <boxGeometry args={[Math.min(1.8, block.width * 0.22), floorHeight * 0.68, Math.min(1.6, block.depth * 0.22)]} />
                    <meshStandardMaterial color={shell} roughness={0.72} />
                </mesh>
            )}

            {flatTop && panels.map((panel) => (
                <mesh key={`pv-${panel.x}-${panel.z}`} position={[panel.x, top + 0.28, panel.z]} rotation-x={-Math.PI / 2.6}>
                    <boxGeometry args={[panel.width, panel.depth, 0.04]} />
                    <meshStandardMaterial color={dark ? "#12233f" : "#1d3557"} roughness={0.22} metalness={0.6} />
                </mesh>
            ))}
        </group>
    );
}

function GroundContext({ layout, palette, dark }: Readonly<{ layout: TwinLayout; palette: ScenePalette; dark: boolean }>) {
    const { width, depth } = layout;
    const apron = Math.max(width, depth) * 0.62;
    const bays = Math.max(3, Math.min(7, Math.round(width / 2)));
    const laneZ = -depth / 2 - 2.4;
    return (
        <group>
            <mesh rotation-x={-Math.PI / 2} position={[0, 0.006, 0]}>
                <ringGeometry args={[apron, apron + 1.5, 64]} />
                <meshStandardMaterial color={dark ? palette.surface : palette.surfaceAlt} roughness={0.95} />
            </mesh>
            {Array.from({ length: bays }, (_, bay) => (
                <mesh
                    key={`bay-${bay}`}
                    rotation-x={-Math.PI / 2}
                    position={[-((bays - 1) * 1.1) / 2 + bay * 1.1, 0.012, laneZ]}
                >
                    <planeGeometry args={[0.9, 2]} />
                    <meshBasicMaterial color={palette.primary} transparent opacity={dark ? 0.18 : 0.22} />
                </mesh>
            ))}
        </group>
    );
}

export default function BuildingDetail({
    layout,
    palette,
    dark,
    solarPanels,
}: Readonly<{ layout: TwinLayout; palette: ScenePalette; dark: boolean; solarPanels: number }>) {
    const detail = layout.massing.detail;
    return (
        <group>
            <mesh position={[0, 0.06, 0]}>
                <boxGeometry args={[layout.width + 1.1, 0.12, layout.depth + 1.1]} />
                <meshStandardMaterial color={dark ? palette.surfaceAlt : palette.surface} roughness={0.9} />
            </mesh>
            <GroundContext layout={layout} palette={palette} dark={dark} />
            {detail.windows && <Windows layout={layout} palette={palette} dark={dark} />}
            {detail.balconies && <Balconies layout={layout} palette={palette} dark={dark} />}
            {detail.fins && <Fins layout={layout} palette={palette} />}
            {detail.parapet && <Parapet layout={layout} palette={palette} dark={dark} />}
            <Entrance layout={layout} palette={palette} dark={dark} />
            <RoofEquipment layout={layout} palette={palette} dark={dark} solarPanels={solarPanels} />
        </group>
    );
}