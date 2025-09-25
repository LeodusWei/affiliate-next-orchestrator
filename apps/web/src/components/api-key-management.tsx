"use client";

import { useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@affiliate-next-orchestrator/backend/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, CheckCircle, Eye, EyeOff, Key, Loader2, Trash2 } from "lucide-react";

interface ApiKeyFormData {
	hetznerApiKey: string;
	dokployApiKey: string;
	dokployUrl: string;
}

export default function ApiKeyManagement() {
	const [formData, setFormData] = useState<ApiKeyFormData>({
		hetznerApiKey: "",
		dokployApiKey: "",
		dokployUrl: "",
	});
	const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
	const [isValidating, setIsValidating] = useState(false);
	const [validationErrors, setValidationErrors] = useState<string[]>([]);

	// Query for existing API keys
	const apiKeys = useQuery(api.apiKeys.getUserApiKeys);
	
	// Mutations and Actions
	const storeApiKeys = useMutation(api.apiKeys.storeApiKeys);
	const validateApiKeys = useAction(api.apiKeys.validateApiKeys);
	const updateValidationStatus = useMutation(api.apiKeys.updateValidationStatus);
	const deleteApiKeys = useMutation(api.apiKeys.deleteApiKeys);

	const handleInputChange = (field: keyof ApiKeyFormData, value: string) => {
		setFormData(prev => ({ ...prev, [field]: value }));
		// Clear validation errors when user types
		setValidationErrors([]);
	};

	const toggleShowKey = (field: string) => {
		setShowKeys(prev => ({ ...prev, [field]: !prev[field] }));
	};

	const handleSaveKeys = async () => {
		try {
			setIsValidating(true);
			setValidationErrors([]);

			// First validate the keys
			const validation = await validateApiKeys({
				hetznerApiKey: formData.hetznerApiKey || undefined,
				dokployApiKey: formData.dokployApiKey || undefined,
				dokployUrl: formData.dokployUrl || undefined,
			});

			if (validation.errors.length > 0) {
				setValidationErrors(validation.errors);
				return;
			}

			// Store the keys
			await storeApiKeys({
				hetznerApiKey: formData.hetznerApiKey || undefined,
				dokployApiKey: formData.dokployApiKey || undefined,
				dokployUrl: formData.dokployUrl || undefined,
			});

			// Update validation status
			await updateValidationStatus({
				isHetznerValid: validation.hetznerValid,
				isDokployValid: validation.dokployValid,
			});

			// Clear form
			setFormData({
				hetznerApiKey: "",
				dokployApiKey: "",
				dokployUrl: "",
			});

		} catch (error) {
			console.error("Failed to save API keys:", error);
			setValidationErrors(["Failed to save API keys. Please try again."]);
		} finally {
			setIsValidating(false);
		}
	};

	const handleDeleteKeys = async (service: "hetzner" | "dokploy" | "all") => {
		if (confirm(`Are you sure you want to delete ${service === "all" ? "all" : service} API keys?`)) {
			try {
				await deleteApiKeys({ service });
			} catch (error) {
				console.error("Failed to delete API keys:", error);
			}
		}
	};

	const hasUnsavedChanges = formData.hetznerApiKey || formData.dokployApiKey || formData.dokployUrl;

	return (
		<div className="space-y-6">
			{/* Current Status */}
			{apiKeys && (
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Key className="w-5 h-5" />
							API Key Status
						</CardTitle>
						<CardDescription>
							Current status of your API keys and last validation
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							{/* Hetzner Status */}
							<div className="flex items-center justify-between p-3 border rounded-lg">
								<div>
									<div className="font-medium">Hetzner Cloud</div>
									<div className="text-sm text-muted-foreground">
										{apiKeys.hasHetznerKey ? "Key configured" : "No key configured"}
									</div>
								</div>
								<div className="flex items-center gap-2">
									{apiKeys.hasHetznerKey && (
										<div className={`flex items-center gap-1 text-sm ${
											apiKeys.isHetznerValid ? "text-green-600" : "text-red-600"
										}`}>
											{apiKeys.isHetznerValid ? (
												<><CheckCircle className="w-4 h-4" /> Valid</>
											) : (
												<><AlertCircle className="w-4 h-4" /> Invalid</>
											)}
										</div>
									)}
									{apiKeys.hasHetznerKey && (
										<Button
											variant="outline"
											size="sm"
											onClick={() => handleDeleteKeys("hetzner")}
										>
											<Trash2 className="w-4 h-4" />
										</Button>
									)}
								</div>
							</div>

							{/* Dokploy Status */}
							<div className="flex items-center justify-between p-3 border rounded-lg">
								<div>
									<div className="font-medium">Dokploy</div>
									<div className="text-sm text-muted-foreground">
										{apiKeys.hasDokployKey ? "Key configured" : "No key configured"}
									</div>
								</div>
								<div className="flex items-center gap-2">
									{apiKeys.hasDokployKey && (
										<div className={`flex items-center gap-1 text-sm ${
											apiKeys.isDokployValid ? "text-green-600" : "text-red-600"
										}`}>
											{apiKeys.isDokployValid ? (
												<><CheckCircle className="w-4 h-4" /> Valid</>
											) : (
												<><AlertCircle className="w-4 h-4" /> Invalid</>
											)}
										</div>
									)}
									{apiKeys.hasDokployKey && (
										<Button
											variant="outline"
											size="sm"
											onClick={() => handleDeleteKeys("dokploy")}
										>
											<Trash2 className="w-4 h-4" />
										</Button>
									)}
								</div>
							</div>
						</div>

						{apiKeys.lastValidated && (
							<div className="text-sm text-muted-foreground">
								Last validated: {new Date(apiKeys.lastValidated).toLocaleDateString()}
							</div>
						)}
					</CardContent>
				</Card>
			)}

			{/* API Key Form */}
			<Card>
				<CardHeader>
					<CardTitle>Add/Update API Keys</CardTitle>
					<CardDescription>
						Configure your Hetzner Cloud and Dokploy API keys to enable server provisioning
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					{/* Validation Errors */}
					{validationErrors.length > 0 && (
						<div className="p-3 bg-red-50 border border-red-200 rounded-lg">
							<div className="flex items-center gap-2 text-red-800 font-medium mb-2">
								<AlertCircle className="w-4 h-4" />
								Validation Failed
							</div>
							<ul className="list-disc list-inside text-sm text-red-700 space-y-1">
								{validationErrors.map((error, index) => (
									<li key={index}>{error}</li>
								))}
							</ul>
						</div>
					)}

					{/* Hetzner API Key */}
					<div className="space-y-2">
						<Label htmlFor="hetzner-key">Hetzner Cloud API Key</Label>
						<div className="relative">
							<Input
								id="hetzner-key"
								type={showKeys.hetzner ? "text" : "password"}
								placeholder="Enter your Hetzner Cloud API key"
								value={formData.hetznerApiKey}
								onChange={(e) => handleInputChange("hetznerApiKey", e.target.value)}
							/>
							<Button
								type="button"
								variant="ghost"
								size="sm"
								className="absolute right-1 top-1 h-7 w-7 p-0"
								onClick={() => toggleShowKey("hetzner")}
							>
								{showKeys.hetzner ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
							</Button>
						</div>
						<div className="text-sm text-muted-foreground">
							Get your API key from the{" "}
							<a href="https://console.hetzner.cloud/" target="_blank" className="text-blue-600 hover:underline">
								Hetzner Cloud Console
							</a>
						</div>
					</div>

					{/* Dokploy URL */}
					<div className="space-y-2">
						<Label htmlFor="dokploy-url">Dokploy Instance URL</Label>
						<Input
							id="dokploy-url"
							type="url"
							placeholder="https://your-dokploy-instance.com"
							value={formData.dokployUrl}
							onChange={(e) => handleInputChange("dokployUrl", e.target.value)}
						/>
						<div className="text-sm text-muted-foreground">
							URL of your Dokploy instance (with https://)
						</div>
					</div>

					{/* Dokploy API Key */}
					<div className="space-y-2">
						<Label htmlFor="dokploy-key">Dokploy API Key</Label>
						<div className="relative">
							<Input
								id="dokploy-key"
								type={showKeys.dokploy ? "text" : "password"}
								placeholder="Enter your Dokploy API key"
								value={formData.dokployApiKey}
								onChange={(e) => handleInputChange("dokployApiKey", e.target.value)}
							/>
							<Button
								type="button"
								variant="ghost"
								size="sm"
								className="absolute right-1 top-1 h-7 w-7 p-0"
								onClick={() => toggleShowKey("dokploy")}
							>
								{showKeys.dokploy ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
							</Button>
						</div>
						<div className="text-sm text-muted-foreground">
							Generate an API key from your Dokploy dashboard
						</div>
					</div>

					{/* Actions */}
					<div className="flex gap-2 pt-4">
						<Button
							onClick={handleSaveKeys}
							disabled={!hasUnsavedChanges || isValidating}
						>
							{isValidating && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
							{isValidating ? "Validating..." : "Save & Validate"}
						</Button>
						
						{hasUnsavedChanges && (
							<Button
								variant="outline"
								onClick={() => setFormData({ hetznerApiKey: "", dokployApiKey: "", dokployUrl: "" })}
							>
								Clear
							</Button>
						)}
						
						{apiKeys?.hasHetznerKey || apiKeys?.hasDokployKey ? (
							<Button
								variant="destructive"
								onClick={() => handleDeleteKeys("all")}
							>
								Delete All Keys
							</Button>
						) : null}
					</div>
				</CardContent>
			</Card>
		</div>
	);
}