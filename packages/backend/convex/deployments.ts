import { query, mutation, action } from "./_generated/server";
import { v } from "convex/values";
import { authComponent } from "./auth";
import { internal } from "./_generated/api";

// Get all deployments for the current user
export const getUserDeployments = query({
	args: {},
	handler: async (ctx) => {
		const user = await authComponent.getAuthUser(ctx);
		if (!user) {
			throw new Error("Not authenticated");
		}

		const deployments = await ctx.db
			.query("deployments")
			.withIndex("by_user", (q) => q.eq("userId", user._id))
			.collect();

		// Get server information for each deployment
		const deploymentsWithServerInfo = await Promise.all(
			deployments.map(async (deployment) => {
				const server = await ctx.db.get(deployment.serverId);
				return {
					_id: deployment._id,
					serverId: deployment.serverId,
					serverName: server?.name || "Unknown Server",
					name: deployment.name,
					domain: deployment.domain,
					status: deployment.status,
					wordpressAdminUser: deployment.wordpressAdminUser,
					sslEnabled: deployment.sslEnabled,
					createdAt: deployment.createdAt,
					errorMessage: deployment.errorMessage,
				};
			})
		);

		return deploymentsWithServerInfo;
	},
});

// Get deployments for a specific server
export const getServerDeployments = query({
	args: { serverId: v.id("servers") },
	handler: async (ctx, args) => {
		const user = await authComponent.getAuthUser(ctx);
		if (!user) {
			throw new Error("Not authenticated");
		}

		// Verify user owns the server
		const server = await ctx.db.get(args.serverId);
		if (!server || server.userId !== user._id) {
			throw new Error("Server not found or access denied");
		}

		const deployments = await ctx.db
			.query("deployments")
			.withIndex("by_server", (q) => q.eq("serverId", args.serverId))
			.collect();

		return deployments.map(deployment => ({
			_id: deployment._id,
			name: deployment.name,
			domain: deployment.domain,
			status: deployment.status,
			wordpressAdminUser: deployment.wordpressAdminUser,
			sslEnabled: deployment.sslEnabled,
			createdAt: deployment.createdAt,
			errorMessage: deployment.errorMessage,
		}));
	},
});

// Get a specific deployment
export const getDeployment = query({
	args: { deploymentId: v.id("deployments") },
	handler: async (ctx, args) => {
		const user = await authComponent.getAuthUser(ctx);
		if (!user) {
			throw new Error("Not authenticated");
		}

		const deployment = await ctx.db.get(args.deploymentId);
		if (!deployment || deployment.userId !== user._id) {
			return null;
		}

		const server = await ctx.db.get(deployment.serverId);

		return {
			_id: deployment._id,
			serverId: deployment.serverId,
			serverName: server?.name || "Unknown Server",
			name: deployment.name,
			domain: deployment.domain,
			status: deployment.status,
			wordpressAdminUser: deployment.wordpressAdminUser,
			sslEnabled: deployment.sslEnabled,
			createdAt: deployment.createdAt,
			errorMessage: deployment.errorMessage,
		};
	},
});

// Create a new WordPress deployment
export const createDeployment = mutation({
	args: {
		serverId: v.id("servers"),
		name: v.string(),
		domain: v.optional(v.string()),
		wordpressAdminUser: v.string(),
		wordpressAdminPass: v.string(),
		enableSsl: v.boolean(),
	},
	handler: async (ctx, args) => {
		const user = await authComponent.getAuthUser(ctx);
		if (!user) {
			throw new Error("Not authenticated");
		}

		// Verify server exists and is ready
		const server = await ctx.db.get(args.serverId);
		if (!server || server.userId !== user._id) {
			throw new Error("Server not found or access denied");
		}

		if (server.status !== "ready" || !server.dokployInstalled) {
			throw new Error("Server is not ready for deployments");
		}

		// Check if user has valid Dokploy API keys
		const apiKeys = await ctx.db
			.query("apiKeys")
			.withIndex("by_user", (q) => q.eq("userId", user._id))
			.unique();

		if (!apiKeys?.isDokployValid) {
			throw new Error("Valid Dokploy API key required");
		}

		// For MVP, store password as-is. In production, implement encryption
		// TODO: Implement proper password encryption
		const encryptedPassword = args.wordpressAdminPass;

		const deploymentId = await ctx.db.insert("deployments", {
			userId: user._id,
			serverId: args.serverId,
			name: args.name,
			domain: args.domain,
			status: "deploying",
			wordpressAdminUser: args.wordpressAdminUser,
			wordpressAdminPass: encryptedPassword,
			sslEnabled: args.enableSsl,
			createdAt: Date.now(),
		});

		// Schedule deployment action
		await ctx.scheduler.runAfter(0, internal.deployments.deployWordPress, { deploymentId });

		return deploymentId;
	},
});

// Update deployment status
export const updateDeploymentStatus = mutation({
	args: {
		deploymentId: v.id("deployments"),
		status: v.union(
			v.literal("deploying"),
			v.literal("running"),
			v.literal("stopped"),
			v.literal("error")
		),
		errorMessage: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const user = await authComponent.getAuthUser(ctx);
		if (!user) {
			throw new Error("Not authenticated");
		}

		const deployment = await ctx.db.get(args.deploymentId);
		if (!deployment || deployment.userId !== user._id) {
			throw new Error("Deployment not found or access denied");
		}

		const updates: any = { status: args.status };
		if (args.errorMessage !== undefined) {
			updates.errorMessage = args.errorMessage;
		}

		await ctx.db.patch(args.deploymentId, updates);
		return null;
	},
});

// Delete a deployment
export const deleteDeployment = mutation({
	args: { deploymentId: v.id("deployments") },
	handler: async (ctx, args) => {
		const user = await authComponent.getAuthUser(ctx);
		if (!user) {
			throw new Error("Not authenticated");
		}

		const deployment = await ctx.db.get(args.deploymentId);
		if (!deployment || deployment.userId !== user._id) {
			throw new Error("Deployment not found or access denied");
		}

		// Mark as stopped first, then schedule cleanup
		await ctx.db.patch(args.deploymentId, { status: "stopped" });
		await ctx.scheduler.runAfter(0, internal.deployments.destroyWordPress, { deploymentId: args.deploymentId });

		return null;
	},
});

// WordPress deployment action (placeholder implementation)
export const deployWordPress = action({
	args: { deploymentId: v.id("deployments") },
	handler: async (ctx, args) => {
		// This is a placeholder for the actual Dokploy API integration
		// TODO: Implement actual WordPress deployment logic

		try {
			const deployment = await ctx.runQuery(internal.deployments.getDeployment, { deploymentId: args.deploymentId });
			if (!deployment) {
				throw new Error("Deployment not found");
			}

			// Step 1: Deploy WordPress container via Dokploy
			// TODO: Implement actual Dokploy API calls

			// Step 2: Install Elementor plugin
			// TODO: Implement plugin installation

			// Step 3: Configure SSL if requested
			if (deployment.sslEnabled && deployment.domain) {
				// TODO: Implement SSL configuration via Let's Encrypt
			}

			// Simulate deployment time
			await new Promise(resolve => setTimeout(resolve, 2000));

			// Step 4: Mark as running
			await ctx.runMutation(internal.deployments.updateDeploymentStatus, {
				deploymentId: args.deploymentId,
				status: "running",
			});

		} catch (error) {
			// Mark deployment as error
			await ctx.runMutation(internal.deployments.updateDeploymentStatus, {
				deploymentId: args.deploymentId,
				status: "error",
				errorMessage: error instanceof Error ? error.message : "Unknown error",
			});
		}

		return null;
	},
});

// WordPress destruction action (placeholder implementation)
export const destroyWordPress = action({
	args: { deploymentId: v.id("deployments") },
	handler: async (ctx, args) => {
		// This is a placeholder for the actual Dokploy API integration
		// TODO: Implement actual WordPress cleanup logic

		try {
			// Step 1: Remove WordPress container via Dokploy API
			// TODO: Implement actual cleanup logic

			// Step 2: Remove from database using mutation
			await ctx.runMutation(internal.deployments.deleteDeploymentRecord, { deploymentId: args.deploymentId });

		} catch (error) {
			// Log error but still try to clean up database
			console.error("Error destroying WordPress deployment:", error);
			await ctx.runMutation(internal.deployments.deleteDeploymentRecord, { deploymentId: args.deploymentId });
		}

		return null;
	},
});

// Internal mutation to delete deployment record from database
export const deleteDeploymentRecord = mutation({
	args: { deploymentId: v.id("deployments") },
	handler: async (ctx, args) => {
		await ctx.db.delete(args.deploymentId);
		return null;
	},
});