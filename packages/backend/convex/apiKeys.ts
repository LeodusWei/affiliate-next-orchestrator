import { query, mutation, action, internalQuery, internalMutation, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { authComponent } from "./auth";

// Note: For MVP, we're storing API keys without encryption
// In production, implement proper encryption with a secure key management system

// Get user's API keys
export const getUserApiKeys = query({
	args: {},
	handler: async (ctx) => {
		const user = await authComponent.getAuthUser(ctx);
		if (!user) {
			throw new Error("Not authenticated");
		}

		const apiKeys = await ctx.db
			.query("apiKeys")
			.withIndex("by_user", (q) => q.eq("userId", user._id))
			.unique();

		if (!apiKeys) {
			return null;
		}

		return {
			_id: apiKeys._id,
			hasHetznerKey: !!apiKeys.hetznerApiKey,
			hasDokployKey: !!apiKeys.dokployApiKey,
			dokployUrl: apiKeys.dokployUrl,
			isHetznerValid: apiKeys.isHetznerValid,
			isDokployValid: apiKeys.isDokployValid,
			lastValidated: apiKeys.lastValidated,
		};
	},
});

// Store encrypted API keys
export const storeApiKeys = mutation({
	args: {
		hetznerApiKey: v.optional(v.string()),
		dokployApiKey: v.optional(v.string()),
		dokployUrl: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const user = await authComponent.getAuthUser(ctx);
		if (!user) {
			throw new Error("Not authenticated");
		}

		try {
			// For MVP, store keys as-is. In production, implement proper encryption
			// TODO: Implement encryption by calling internal actions
			const encryptedHetznerKey = args.hetznerApiKey;
			const encryptedDokployKey = args.dokployApiKey;

		const existingKeys = await ctx.db
			.query("apiKeys")
			.withIndex("by_user", (q) => q.eq("userId", user._id))
			.unique();

		if (existingKeys) {
			// Update existing keys
			await ctx.db.patch(existingKeys._id, {
				hetznerApiKey: encryptedHetznerKey || existingKeys.hetznerApiKey,
				dokployApiKey: encryptedDokployKey || existingKeys.dokployApiKey,
				dokployUrl: args.dokployUrl || existingKeys.dokployUrl,
				isHetznerValid: false, // Reset validation status when keys change
				isDokployValid: false,
				lastValidated: undefined,
			});
			return existingKeys._id;
		} else {
		// Create new keys record
		return await ctx.db.insert("apiKeys", {
			userId: user._id,
			hetznerApiKey: encryptedHetznerKey,
			dokployApiKey: encryptedDokployKey,
			dokployUrl: args.dokployUrl,
			isHetznerValid: false,
			isDokployValid: false,
		});
	}

	} catch (error) {
		console.error("Error storing API keys:", error);
		throw new Error("Failed to store API keys");
	}
	},
});

// Validate API keys with real API calls  
export const validateApiKeys = action({
	args: {
		hetznerApiKey: v.optional(v.string()),
		dokployApiKey: v.optional(v.string()),
		dokployUrl: v.optional(v.string()),
	},

	handler: async (ctx, args) => {
		const errors: string[] = [];
		let hetznerValid = false;
		let dokployValid = false;

		// Validate Hetzner API key
		if (args.hetznerApiKey) {
			try {
				const response = await fetch("https://api.hetzner.cloud/v1/locations", {
					method: "GET",
					headers: {
						"Authorization": `Bearer ${args.hetznerApiKey}`,
						"Content-Type": "application/json",
					},
				});

				if (response.ok) {
					hetznerValid = true;
				} else if (response.status === 401) {
					errors.push("Invalid Hetzner API key - authentication failed");
				} else {
					errors.push("Failed to validate Hetzner API key - API error");
				}
			} catch (error) {
				console.error("Hetzner API validation error:", error);
				errors.push("Failed to connect to Hetzner API");
			}
		}

		// Validate Dokploy API key
		if (args.dokployApiKey && args.dokployUrl) {
			try {
				// Ensure URL has proper format
				const baseUrl = args.dokployUrl.endsWith("/") ? args.dokployUrl.slice(0, -1) : args.dokployUrl;
				
				const response = await fetch(`${baseUrl}/api/auth/profile`, {
					method: "GET",
					headers: {
						"Authorization": `Bearer ${args.dokployApiKey}`,
						"Content-Type": "application/json",
					},
				});

				if (response.ok) {
					dokployValid = true;
				} else if (response.status === 401) {
					errors.push("Invalid Dokploy API key - authentication failed");
				} else {
					errors.push("Failed to validate Dokploy API key - API error");
				}
			} catch (error) {
				console.error("Dokploy API validation error:", error);
				errors.push("Failed to connect to Dokploy API - check URL and network connectivity");
			}
		}

		return {
			hetznerValid,
			dokployValid,
			errors,
		};
	},
});

// Update validation status after API validation
export const updateValidationStatus = mutation({
	args: {
		isHetznerValid: v.boolean(),
		isDokployValid: v.boolean(),
	},

	handler: async (ctx, args) => {
		const user = await authComponent.getAuthUser(ctx);
		if (!user) {
			throw new Error("Not authenticated");
		}

		const apiKeys = await ctx.db
			.query("apiKeys")
			.withIndex("by_user", (q) => q.eq("userId", user._id))
			.unique();

		if (apiKeys) {
			await ctx.db.patch(apiKeys._id, {
				isHetznerValid: args.isHetznerValid,
				isDokployValid: args.isDokployValid,
				lastValidated: Date.now(),
			});
		}

		return null;
	},
});

// Internal function to get decrypted API keys for use in other functions
export const getDecryptedApiKeys = internalQuery({
	args: { userId: v.string() },
	handler: async (ctx, args) => {
		const apiKeys = await ctx.db
			.query("apiKeys")
			.withIndex("by_user", (q) => q.eq("userId", args.userId))
			.unique();

		if (!apiKeys) {
			return null;
		}

		return {
			hetznerApiKey: apiKeys.hetznerApiKey,
			dokployApiKey: apiKeys.dokployApiKey,
			dokployUrl: apiKeys.dokployUrl,
			isHetznerValid: apiKeys.isHetznerValid,
			isDokployValid: apiKeys.isDokployValid,
		};
	},
});

// Delete API keys
export const deleteApiKeys = mutation({
	args: { service: v.optional(v.union(v.literal("hetzner"), v.literal("dokploy"), v.literal("all"))) },
	handler: async (ctx, args) => {
		const user = await authComponent.getAuthUser(ctx);
		if (!user) {
			throw new Error("Not authenticated");
		}

		const apiKeys = await ctx.db
			.query("apiKeys")
			.withIndex("by_user", (q) => q.eq("userId", user._id))
			.unique();

		if (!apiKeys) {
			return null;
		}

		const service = args.service || "all";

		if (service === "all") {
			// Delete the entire record
			await ctx.db.delete(apiKeys._id);
		} else if (service === "hetzner") {
			// Clear Hetzner keys
			await ctx.db.patch(apiKeys._id, {
				hetznerApiKey: undefined,
				isHetznerValid: false,
				lastValidated: undefined,
			});
		} else if (service === "dokploy") {
		// Clear Dokploy keys
		await ctx.db.patch(apiKeys._id, {
			dokployApiKey: undefined,
			dokployUrl: undefined,
			isDokployValid: false,
			lastValidated: undefined,
		});
	}

	return null;
	},
});