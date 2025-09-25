import { query, mutation, action, internalQuery, internalMutation, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { authComponent } from "./auth";
import { internal } from "./_generated/api";

// Get all servers for the current user
export const getUserServers = query({
	args: {},
	handler: async (ctx) => {
		const user = await authComponent.getAuthUser(ctx);
		if (!user) {
			throw new Error("Not authenticated");
		}

		const servers = await ctx.db
			.query("servers")
			.withIndex("by_user", (q) => q.eq("userId", user._id))
			.collect();

		return servers.map(server => ({
			_id: server._id,
			name: server.name,
			ipAddress: server.ipAddress,
			status: server.status,
			region: server.region,
			dokployInstalled: server.dokployInstalled,
			createdAt: server.createdAt,
			errorMessage: server.errorMessage,
		}));
	},
});

// Get a specific server by ID (internal)
export const getServer = internalQuery({
	args: { serverId: v.id("servers") },
	handler: async (ctx, args) => {
		const user = await authComponent.getAuthUser(ctx);
		if (!user) {
			throw new Error("Not authenticated");
		}

		const server = await ctx.db.get(args.serverId);
		if (!server || server.userId !== user._id) {
			return null;
		}

		return {
			_id: server._id,
			name: server.name,
			hetznerServerId: server.hetznerServerId,
			ipAddress: server.ipAddress,
			status: server.status,
			region: server.region,
			dokployInstalled: server.dokployInstalled,
			createdAt: server.createdAt,
			errorMessage: server.errorMessage,
		};
	},
});

// Create a new server record (starts the provisioning process)
export const createServer = mutation({
	args: {
		name: v.string(),
		region: v.string(),
	},
	handler: async (ctx, args) => {
		const user = await authComponent.getAuthUser(ctx);
		if (!user) {
			throw new Error("Not authenticated");
		}

		// Check if user has valid API keys
		const apiKeys = await ctx.db
			.query("apiKeys")
			.withIndex("by_user", (q) => q.eq("userId", user._id))
			.unique();

		if (!apiKeys?.isHetznerValid) {
			throw new Error("Valid Hetzner API key required");
		}

		const serverId = await ctx.db.insert("servers", {
			userId: user._id,
			hetznerServerId: "", // Will be set when server is actually created
			name: args.name,
			status: "creating",
			region: args.region,
			dokployInstalled: false,
			createdAt: Date.now(),
		});

		// Schedule server provisioning action
		await ctx.scheduler.runAfter(0, internal.servers.provisionServer, { serverId });

		return serverId;
	},
});

// Update server status
export const updateServerStatus = internalMutation({
	args: {
		serverId: v.id("servers"),
		status: v.union(
			v.literal("creating"),
			v.literal("installing"),
			v.literal("configuring"),
			v.literal("ready"),
			v.literal("error"),
			v.literal("deleting")
		),
		ipAddress: v.optional(v.string()),
		hetznerServerId: v.optional(v.string()),
		errorMessage: v.optional(v.string()),
		dokployInstalled: v.optional(v.boolean()),
	},
	handler: async (ctx, args) => {
		const user = await authComponent.getAuthUser(ctx);
		if (!user) {
			throw new Error("Not authenticated");
		}

		const server = await ctx.db.get(args.serverId);
		if (!server || server.userId !== user._id) {
			throw new Error("Server not found or access denied");
		}

		const updates: any = { status: args.status };
		if (args.ipAddress !== undefined) updates.ipAddress = args.ipAddress;
		if (args.hetznerServerId !== undefined) updates.hetznerServerId = args.hetznerServerId;
		if (args.errorMessage !== undefined) updates.errorMessage = args.errorMessage;
		if (args.dokployInstalled !== undefined) updates.dokployInstalled = args.dokployInstalled;

		await ctx.db.patch(args.serverId, updates);
		return null;
	},
});

// Delete a server
export const deleteServer = mutation({
	args: { serverId: v.id("servers") },
	handler: async (ctx, args) => {
		const user = await authComponent.getAuthUser(ctx);
		if (!user) {
			throw new Error("Not authenticated");
		}

		const server = await ctx.db.get(args.serverId);
		if (!server || server.userId !== user._id) {
			throw new Error("Server not found or access denied");
		}

		// Mark server for deletion
		await ctx.db.patch(args.serverId, { status: "deleting" });

		// Schedule server deletion action
		await ctx.scheduler.runAfter(0, internal.servers.destroyServer, { serverId: args.serverId });

		return null;
	},
});

// Server provisioning action (placeholder implementation)
export const provisionServer = internalAction({
	args: { serverId: v.id("servers") },
	handler: async (ctx, args) => {
		// This is a placeholder for the actual Hetzner API integration
		// TODO: Implement actual server provisioning logic

		try {
			// Step 1: Create server via Hetzner API
			await ctx.runMutation(internal.servers.updateServerStatus, {
				serverId: args.serverId,
				status: "installing",
				hetznerServerId: "placeholder-server-id",
				ipAddress: "192.168.1.100", // Placeholder IP
			});

			// Step 2: Wait for server to be ready and install Dokploy
			// TODO: Implement actual installation logic
			
			// Simulate installation time
			await new Promise(resolve => setTimeout(resolve, 1000));

			// Step 3: Configure server
			await ctx.runMutation(internal.servers.updateServerStatus, {
				serverId: args.serverId,
				status: "configuring",
			});

			// Step 4: Mark as ready
			await ctx.runMutation(internal.servers.updateServerStatus, {
				serverId: args.serverId,
				status: "ready",
				dokployInstalled: true,
			});

		} catch (error) {
			// Mark server as error and cleanup
			await ctx.runMutation(internal.servers.updateServerStatus, {
				serverId: args.serverId,
				status: "error",
				errorMessage: error instanceof Error ? error.message : "Unknown error",
			});

			// Schedule cleanup
			await ctx.scheduler.runAfter(0, internal.servers.destroyServer, { serverId: args.serverId });
		}

		return null;
	},
});

// Server destruction action (placeholder implementation)
export const destroyServer = internalAction({
	args: { serverId: v.id("servers") },
	handler: async (ctx, args) => {
		// This is a placeholder for the actual Hetzner API integration
		// TODO: Implement actual server destruction logic

		try {
			const server = await ctx.runQuery(internal.servers.getServer, { serverId: args.serverId });
			if (!server) {
				return null;
			}

			// Step 1: Delete server via Hetzner API
			// TODO: Implement actual deletion logic

			// Step 2: Remove from database using a mutation
			await ctx.runMutation(internal.servers.deleteServerRecord, { serverId: args.serverId });

		} catch (error) {
			// Log error but still try to clean up database
			console.error("Error destroying server:", error);
			await ctx.runMutation(internal.servers.deleteServerRecord, { serverId: args.serverId });
		}

		return null;
	},
});

// Internal mutation to delete server record from database
export const deleteServerRecord = internalMutation({
	args: { serverId: v.id("servers") },
	handler: async (ctx, args) => {
		await ctx.db.delete(args.serverId);
		return null;
	},
});