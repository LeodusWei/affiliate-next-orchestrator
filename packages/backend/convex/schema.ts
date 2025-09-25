import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
	todos: defineTable({
		text: v.string(),
		completed: v.boolean(),
	}),

	// API Keys management for Hetzner and Dokploy integrations
	apiKeys: defineTable({
		userId: v.string(), // from better-auth
		hetznerApiKey: v.optional(v.string()), // encrypted
		dokployApiKey: v.optional(v.string()), // encrypted
		dokployUrl: v.optional(v.string()),
		isHetznerValid: v.boolean(),
		isDokployValid: v.boolean(),
		lastValidated: v.optional(v.number()),
	}).index("by_user", ["userId"]),

	// Hetzner servers managed by the platform
	servers: defineTable({
		userId: v.string(),
		hetznerServerId: v.string(),
		name: v.string(),
		ipAddress: v.optional(v.string()),
		status: v.union(
			v.literal("creating"),
			v.literal("installing"),
			v.literal("configuring"),
			v.literal("ready"),
			v.literal("error"),
			v.literal("deleting")
		),
		region: v.string(),
		sshKeyId: v.optional(v.string()),
		dokployInstalled: v.boolean(),
		createdAt: v.number(),
		errorMessage: v.optional(v.string()),
	}).index("by_user", ["userId"])
	  .index("by_status", ["status"]),

	// WordPress deployments on servers
	deployments: defineTable({
		userId: v.string(),
		serverId: v.id("servers"),
		name: v.string(),
		domain: v.optional(v.string()),
		status: v.union(
			v.literal("deploying"),
			v.literal("running"),
			v.literal("stopped"),
			v.literal("error")
		),
		wordpressAdminUser: v.string(),
		wordpressAdminPass: v.string(), // encrypted
		sslEnabled: v.boolean(),
		createdAt: v.number(),
		errorMessage: v.optional(v.string()),
	}).index("by_user", ["userId"])
	  .index("by_server", ["serverId"])
	  .index("by_status", ["status"]),

	// Monitoring and health check logs
	healthChecks: defineTable({
		resourceType: v.union(
			v.literal("server"),
			v.literal("deployment"),
			v.literal("api")
		),
		resourceId: v.string(), // server ID, deployment ID, or API name
		status: v.union(
			v.literal("healthy"),
			v.literal("warning"),
			v.literal("error")
		),
		checkType: v.string(), // "http", "ssh", "api", etc.
		responseTime: v.optional(v.number()),
		errorMessage: v.optional(v.string()),
		checkedAt: v.number(),
	}).index("by_resource", ["resourceType", "resourceId"])
	  .index("by_status", ["status"])
	  .index("by_time", ["checkedAt"]),

	// System logs for debugging and audit trail
	systemLogs: defineTable({
		userId: v.optional(v.string()),
		level: v.union(
			v.literal("info"),
			v.literal("warning"),
			v.literal("error"),
			v.literal("debug")
		),
		category: v.string(), // "auth", "server", "deployment", "api", etc.
		message: v.string(),
		metadata: v.optional(v.object({})), // additional context data
		timestamp: v.number(),
	}).index("by_user", ["userId"])
	  .index("by_level", ["level"])
	  .index("by_category", ["category"])
	  .index("by_time", ["timestamp"]),
});
