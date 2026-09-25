import { applyRecommendation, viewRecommendationService, updateTariffService } from '../../../backend/core/src/services/recommendation.service';
import prisma from '../../../backend/core/src/lib/prisma';
import { analyticsQueue } from '../../../backend/core/src/services/bullmq';

jest.mock('../../../backend/core/src/lib/prisma', () => ({
    __esModule: true,
    default: {
        userBuildingAccess: {
            findFirst: jest.fn(),
        },
        optimisationRecommendation: {
            findUnique: jest.fn(),
            update: jest.fn(),
            findMany: jest.fn(),
            deleteMany: jest.fn(),
            updateMany: jest.fn(),
        },
        building: {
            findUnique: jest.fn(),
        },
        utilityTariff: {
            findFirst: jest.fn(),
            update: jest.fn(),
            create: jest.fn(),
        }
    },
}));
jest.mock('../../../backend/core/src/services/bullmq', () => ({
    analyticsQueue: {
        add: jest.fn(),
    },
}));

describe("Recommendation Services Unit Tests", () => {
    beforeEach(() => {jest.clearAllMocks(); });

    it("should_successfully_apply_recommendation", async () => {
        (prisma.userBuildingAccess.findFirst as jest.Mock).mockResolvedValue({ user_id: "user-123", building_id: "build-123" });
        (prisma.optimisationRecommendation.findUnique as jest.Mock).mockResolvedValue({
            recommendation_id: "rec-123",
            building_id: "build-123",
            expires_at: new Date(Date.now() + 100000),
            strategy_description: "Test Strategy",
            applicable_range: {}
        });
        //act
        const out = await applyRecommendation("user-123", "build-123", "rec-123");
        //assert
        expect(out).toEqual({ approvedTradeoff: null });
        expect(prisma.optimisationRecommendation.update).toHaveBeenCalledWith({
            where: {
                recommendation_id: "rec-123"
            },
            data: {
                status: "Pending_Execution"
            }
        });
        expect(analyticsQueue.add).toHaveBeenCalledWith("apply_recommendation", expect.any(Object));
    });

    it("should_throw_error_if_access_denied", async () => {
        (prisma.userBuildingAccess.findFirst as jest.Mock).mockResolvedValue(null);
        //act n assert
        await expect(applyRecommendation("user-123", "build-123", "rec-123")).rejects.toThrow("Access Denied");
        expect(prisma.optimisationRecommendation.findUnique).not.toHaveBeenCalled();
    });

    it("should_throw_error_if_recommendation_not_found", async () => {
        (prisma.userBuildingAccess.findFirst as jest.Mock).mockResolvedValue({ user_id: "user-123", building_id: "build-123" });
        (prisma.optimisationRecommendation.findUnique as jest.Mock).mockResolvedValue(null);
        //act n assert
        await expect(applyRecommendation("user-123", "build-123", "rec-123")).rejects.toThrow("Recommendation not found");
    });

    it("should_throw_error_if_recommendation_expired", async () => {
        (prisma.userBuildingAccess.findFirst as jest.Mock).mockResolvedValue({ user_id: "user-123", building_id: "build-123" });
        (prisma.optimisationRecommendation.findUnique as jest.Mock).mockResolvedValue({
            recommendation_id: "rec-123",
            building_id: "build-123",
            expires_at: new Date(Date.now() - 100000),
            strategy_description: "Test Strategy",
            applicable_range: {}
        });
        //act
        await expect(applyRecommendation("user-123", "build-123", "rec-123")).rejects.toThrow("Expired");
        //assert
        expect(prisma.optimisationRecommendation.update).toHaveBeenCalledWith({
            where: {
                recommendation_id: "rec-123"
            },
            data: {
                status: "Expired"
            }
        });
        expect(analyticsQueue.add).not.toHaveBeenCalled();
    });

    describe("Comfort Trade-off Unit Tests", () => {
        const peakShavingRange = {
            context: "Peak Shaving",
            time_window: { start: "14:00", end: "18:00", timezone: "Africa/Johannesburg" },
            load_bounds_kw: { min_expected: 100, max_allowed: 150 },
            predicted_comfort_score: 45,
            tradeoff_inputs: { outside_temp_c: 22 }
        };

        const peakShavingRecommendation = () => ({
            recommendation_id: "rec-peak",
            building_id: "build-123",
            expires_at: new Date(Date.now() + 100000),
            strategy_description: "Shave the afternoon peak",
            estimated_monthly_savings: 500,
            applicable_range: peakShavingRange
        });

        const allowAccessTo = (recommendation: object) => {
            (prisma.userBuildingAccess.findFirst as jest.Mock).mockResolvedValue({ user_id: "user-123", building_id: "build-123" });
            (prisma.optimisationRecommendation.findUnique as jest.Mock).mockResolvedValue(recommendation);
        };

        it("should_attach_a_tradeoff_profile_to_peak_shaving_recs_only", async () => {
            (prisma.userBuildingAccess.findFirst as jest.Mock).mockResolvedValue({ user_id: "user-123", building_id: "build-123" });
            (prisma.optimisationRecommendation.findMany as jest.Mock).mockResolvedValue([
                peakShavingRecommendation(),
                { recommendation_id: "rec-season", estimated_monthly_savings: 75, applicable_range: { context: "Summer Lighting" } }
            ]);

            const out = await viewRecommendationService("user-123", "build-123");

            expect((out[0] as any).tradeoff.sweet_spot).toEqual({ savings_level: 61, monthly_savings: 305, comfort_score: 80, shed_kw: 30.5 });
            expect((out[0] as any).tradeoff.points).toHaveLength(101);
            expect(out[1]).not.toHaveProperty("tradeoff");
        });

        it("should_record_the_approved_tradeoff_and_its_savings", async () => {
            allowAccessTo(peakShavingRecommendation());
            const out = await applyRecommendation("user-123", "build-123", "rec-peak", { savings_level: 61 });

            expect(out.approvedTradeoff).toMatchObject({
                savings_level: 61,
                monthly_savings: 305,
                comfort_score: 80,
                shed_kw: 30.5,
                comfort_target: 80,
                meets_comfort_target: true,
                full_monthly_savings: 500,
                approved_by: "user-123"
            });

            expect(prisma.optimisationRecommendation.update).toHaveBeenCalledWith({
                where: { recommendation_id: "rec-peak" },
                data: {
                    status: "Pending_Execution",
                    estimated_monthly_savings: 305,
                    applicable_range: expect.objectContaining({
                        context: "Peak Shaving",
                        tradeoff_inputs: { outside_temp_c: 22 },
                        approved_tradeoff: expect.objectContaining({ savings_level: 61, comfort_score: 80 })
                    })
                }
            });

            expect(analyticsQueue.add).toHaveBeenCalledWith("apply_recommendation", expect.objectContaining({
                recommendation_id: "rec-peak",
                approved_tradeoff: expect.objectContaining({ savings_level: 61, monthly_savings: 305 })
            }));
        });

        it("should_refuse_to_apply_peak_shaving_without_a_savings_level", async () => {
            allowAccessTo(peakShavingRecommendation());

            await expect(applyRecommendation("user-123", "build-123", "rec-peak")).rejects.toThrow("Trade-off selection required");
            expect(prisma.optimisationRecommendation.update).not.toHaveBeenCalled();
            expect(analyticsQueue.add).not.toHaveBeenCalled();
        });

        it("should_flag_a_setting_that_breaks_the_comfort_target", async () => {
            allowAccessTo(peakShavingRecommendation());
            const out = await applyRecommendation("user-123", "build-123", "rec-peak", { savings_level: 100 });
            expect(out.approvedTradeoff).toMatchObject({ monthly_savings: 500, comfort_score: 45, meets_comfort_target: false });
        });
    });

    describe("View Recommendation Unit Tests",  () => {
        it("should_return_rec", async () => {
            (prisma.userBuildingAccess.findFirst as jest.Mock).mockResolvedValue({
                user_id: "user123",
                building_id: "building-123"
            });
            (prisma.optimisationRecommendation.findMany as jest.Mock).mockResolvedValue([
                {
                    recommendation_id: "rec-123",
                    status: "Pending"
                }
            ]);
            //act
            const out = await viewRecommendationService("user123", "building-123", "Pending", 10);
            //assert
            expect(prisma.userBuildingAccess.findFirst).toHaveBeenCalledWith({
                where: {
                    user_id: "user123",
                    building_id: "building-123"
                }
            })
            expect(prisma.optimisationRecommendation.findMany).toHaveBeenCalledWith({
                where: expect.objectContaining({
                    building_id: "building-123",
                    status: "Pending"
                }),
                take: 10,
                orderBy: {
                    expires_at: "desc"
                },
                select: expect.any(Object)
            });
            expect(out).toHaveLength(1);
        });

        it("should_throw_error_if_no_access", async () => {
            (prisma.userBuildingAccess.findFirst as jest.Mock).mockResolvedValue(null);
            await expect(viewRecommendationService("user-123", "building-123"))
            .rejects.toThrow("Access Denied");
            expect(prisma.optimisationRecommendation.findMany).not.toHaveBeenCalled();
        })
    });

    describe("Update Tariff Rates Unit Tests", () => {
        it("shiuld_create_tariff_if_noy_exist", async () => {
            (prisma.building.findUnique as jest.Mock).mockResolvedValue({ building_id: "building123" });
            (prisma.userBuildingAccess.findFirst as jest.Mock).mockResolvedValue({
                user_id: "user-123",
                building_id: "building123"
            });

            (prisma.utilityTariff.findFirst as jest.Mock).mockResolvedValue(null);
            (prisma.utilityTariff.create as jest.Mock).mockResolvedValue(true);

            const payload = {
                type: "flat",
                seasons: [{ name: "Summer", startMonth: 9, endMonth: 5 }],
                blocks: [{ max_kwh: null, rates: { "Summer": { "Flat": 2.50 } } }]
            } as any;
            //act
            const out = await updateTariffService("user-123", "building123", payload);
            //asset
            expect(out).toBe(true);
            expect(prisma.utilityTariff.create).toHaveBeenCalledWith({
                data: {
                    building_id: "building123",
                    tariff_structure: payload
                }
            });
            expect(prisma.utilityTariff.update).not.toHaveBeenCalled();
        });

        it("should_update_the_existing_tariff", async () => {
            (prisma.building.findUnique as jest.Mock).mockResolvedValue({ building_id: "building123" });
            (prisma.userBuildingAccess.findFirst as jest.Mock).mockResolvedValue({
                user_id: "user-123",
                building_id: "building123"
            });
            (prisma.utilityTariff.findFirst as jest.Mock).mockResolvedValue({ tariff_id: "tariff-123" });
            (prisma.utilityTariff.update as jest.Mock).mockResolvedValue(true);

            const payload = {
                type: "flat",
                seasons: [{ name: "Winter", startMonth: 6, endMonth: 8 }],
                blocks: [{ max_kwh: null, rates: { "Winter": { "Flat": 3.0 } } }]
            } as any;

            await expect(updateTariffService("user-123", "building123", payload)).resolves.toBe(true);
            expect(prisma.utilityTariff.update).toHaveBeenCalledWith({
                where: { tariff_id: "tariff-123" },
                data: { tariff_structure: payload }
            });
            expect(prisma.utilityTariff.create).not.toHaveBeenCalled();
        });

        it("should_throw_an_error_if_no_building_exists", async ()=>{
            (prisma.building.findUnique as jest.Mock).mockResolvedValue(null);
            const payload = {
                type: "flat",
                seasons: [{ name: "Summer", startMonth: 9, endMonth: 5 }],
                blocks: [{ max_kwh: null, rates: { "Summer": { "Flat": 2.50 } } }]
            } as any;
            //act n assert
            await expect(updateTariffService("user-123", "building123", payload))
            .rejects.toThrow("Building not found");
            expect(prisma.userBuildingAccess.findFirst).not.toHaveBeenCalled();
        });

    });
});
