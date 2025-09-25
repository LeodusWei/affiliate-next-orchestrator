import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { authComponent } from "./auth";
import { internal } from "./_generated/api";

// Log system events
export const logSystemEvent = mutation({
	args: {
		level: v.union(
			v.literal("info"),
			v.literal("warning"),
			v.literal("error"),
			v.literal("debug")
		),
		category: v.string(),
		message: v.string(),
		metadata: v.optional(v.object({})),
	},
	handler: async (ctx, args) => {
		// Get current user if authenticated (optional for system events)
		let userId: string | undefined;
		try {
			const user = await authComponent.getAuthUser(ctx);
			userId = user?._id;
		} catch {
			// Not authenticated - that's ok for system events
		}

		await ctx.db.insert("systemLogs", {
			userId,
			level: args.level,
			category: args.category,
			message: args.message,
			metadata: args.metadata,
			timestamp: Date.now(),
		});

		return null;
	},
});

// Get recent logs (admin function)
export const getRecentLogs = query({
	args: {
		limit: v.optional(v.number()),
		level: v.optional(v.union(
			v.literal("info"),
			v.literal("warning"),
			v.literal("error"),
			v.literal("debug")
		)),
		category: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		// For MVP, allow any authenticated user to view logs
		// TODO: Implement proper admin authorization
		const user = await authComponent.getAuthUser(ctx);
		if (!user) {
			throw new Error("Not authenticated");
		}

		// Use proper query structure
		let queryBuilder;
		if (args.level) {
			queryBuilder = ctx.db.query("systemLogs").withIndex("by_level", (q) => q.eq("level", args.level));
		} else if (args.category) {
			queryBuilder = ctx.db.query("systemLogs").withIndex("by_category", (q) => q.eq("category", args.category));
		} else {
			queryBuilder = ctx.db.query("systemLogs").withIndex("by_time");
		}

		const logs = await queryBuilder
			.order("desc")
			.take(args.limit || 50);

		return logs;
	},
});

// Record health check results
export const recordHealthCheck = mutation({
	args: {
		resourceType: v.union(
			v.literal("server"),
			v.literal("deployment"),
			v.literal("api")
		),
		resourceId: v.string(),
		status: v.union(
			v.literal("healthy"),
			v.literal("warning"),
			v.literal("error")
		),
		checkType: v.string(),
		responseTime: v.optional(v.number()),
		errorMessage: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		await ctx.db.insert("healthChecks", {
			resourceType: args.resourceType,
			resourceId: args.resourceId,
			status: args.status,
			checkType: args.checkType,
			responseTime: args.responseTime,
			errorMessage: args.errorMessage,
			checkedAt: Date.now(),
		});

		// Also log significant health events
		if (args.status === "error") {
			await ctx.runMutation(internal.logging.logSystemEvent, {
				level: "error",
				category: "health_check",
				message: `Health check failed for ${args.resourceType} ${args.resourceId}: ${args.errorMessage || "Unknown error"}`,
				metadata: {
					resourceType: args.resourceType,
					resourceId: args.resourceId,
					checkType: args.checkType,
					responseTime: args.responseTime,
				},
			});
		}

		return null;
	},
});

// Get health status for a resource
export const getResourceHealthStatus = query({
	args: {
		resourceType: v.union(
			v.literal("server"),
			v.literal("deployment"),
			v.literal("api")
		),
		resourceId: v.string(),
		limit: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const healthChecks = await ctx.db
			.query("healthChecks")
			.withIndex("by_resource", (q) => 
				q.eq("resourceType", args.resourceType).eq("resourceId", args.resourceId)
			)
			.order("desc")
			.take(args.limit || 10);

		return healthChecks.map(check => ({
			_id: check._id,
			status: check.status,
			checkType: check.checkType,
			responseTime: check.responseTime,
			errorMessage: check.errorMessage,
			checkedAt: check.checkedAt,
		}));
	},
});