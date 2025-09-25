"use client";

import SignInForm from "@/components/sign-in-form";
import SignUpForm from "@/components/sign-up-form";
import UserMenu from "@/components/user-menu";
import ApiKeyManagement from "@/components/api-key-management";
import { api } from "@affiliate-next-orchestrator/backend/convex/_generated/api";
import {
	Authenticated,
	AuthLoading,
	Unauthenticated,
	useQuery,
} from "convex/react";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Server, Settings, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DashboardPage() {
	const [showSignIn, setShowSignIn] = useState(false);
	const [activeTab, setActiveTab] = useState<"overview" | "servers" | "settings">("overview");
	
	const apiKeys = useQuery(api.apiKeys.getUserApiKeys);

	const hasValidApiKeys = apiKeys?.isHetznerValid && apiKeys?.isDokployValid;

	return (
		<>
			<Authenticated>
				<div className="min-h-screen bg-gray-50">
					{/* Header */}
					<div className="bg-white shadow">
						<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
							<div className="flex justify-between h-16">
								<div className="flex items-center">
									<h1 className="text-2xl font-bold text-gray-900">Orchestrator</h1>
								</div>
								<div className="flex items-center space-x-4">
									<UserMenu />
								</div>
							</div>
						</div>
					</div>

					{/* Navigation */}
					<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
						<div className="mb-6">
							<nav className="flex space-x-8">
								<button
									onClick={() => setActiveTab("overview")}
									className={`${
										activeTab === "overview"
											? "border-blue-500 text-blue-600"
											: "border-transparent text-gray-500 hover:text-gray-700"
									} whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm`}
								>
									Overview
								</button>
								<button
									onClick={() => setActiveTab("servers")}
									className={`${
										activeTab === "servers"
											? "border-blue-500 text-blue-600"
											: "border-transparent text-gray-500 hover:text-gray-700"
									} whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm`}
								>
									Servers
								</button>
								<button
									onClick={() => setActiveTab("settings")}
									className={`${
										activeTab === "settings"
											? "border-blue-500 text-blue-600"
											: "border-transparent text-gray-500 hover:text-gray-700"
									} whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm`}
								>
									Settings
								</button>
							</nav>
						</div>

						{/* Content */}
						{activeTab === "overview" && (
							<div className="space-y-6">
								{/* Welcome Message */}
								{!hasValidApiKeys && (
									<Card className="bg-blue-50 border-blue-200">
										<CardHeader>
											<CardTitle className="text-blue-900">Welcome to Orchestrator!</CardTitle>
											<CardDescription className="text-blue-700">
												To get started, configure your API keys in the Settings tab to enable server provisioning.
											</CardDescription>
										</CardHeader>
										<CardContent>
											<Button onClick={() => setActiveTab("settings")} className="bg-blue-600 hover:bg-blue-700">
												<Settings className="w-4 h-4 mr-2" />
												Configure API Keys
											</Button>
										</CardContent>
									</Card>
								)}

								{/* Quick Stats */}
								<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
									<Card>
										<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
											<CardTitle className="text-sm font-medium">Active Servers</CardTitle>
											<Server className="h-4 w-4 text-muted-foreground" />
										</CardHeader>
										<CardContent>
											<div className="text-2xl font-bold">0</div>
											<p className="text-xs text-muted-foreground">No servers yet</p>
										</CardContent>
									</Card>

									<Card>
										<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
											<CardTitle className="text-sm font-medium">WordPress Sites</CardTitle>
											<Server className="h-4 w-4 text-muted-foreground" />
										</CardHeader>
										<CardContent>
											<div className="text-2xl font-bold">0</div>
											<p className="text-xs text-muted-foreground">No deployments yet</p>
										</CardContent>
									</Card>

									<Card>
										<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
											<CardTitle className="text-sm font-medium">API Status</CardTitle>
											<Settings className="h-4 w-4 text-muted-foreground" />
										</CardHeader>
										<CardContent>
											<div className={`text-2xl font-bold ${hasValidApiKeys ? "text-green-600" : "text-red-600"}`}>
												{hasValidApiKeys ? "Ready" : "Setup Required"}
											</div>
											<p className="text-xs text-muted-foreground">
												{hasValidApiKeys ? "All API keys configured" : "Configure API keys"}
											</p>
										</CardContent>
									</Card>
								</div>

								{/* Quick Actions */}
								{hasValidApiKeys && (
									<Card>
										<CardHeader>
											<CardTitle>Quick Actions</CardTitle>
											<CardDescription>Get started with your first deployment</CardDescription>
										</CardHeader>
										<CardContent className="flex gap-4">
											<Button onClick={() => setActiveTab("servers")}>
												<Plus className="w-4 h-4 mr-2" />
												Create Server
											</Button>
											<Button variant="outline" disabled>
												Deploy WordPress
											</Button>
										</CardContent>
									</Card>
								)}
							</div>
						)}

						{activeTab === "servers" && (
							<div className="space-y-6">
								<div className="flex justify-between items-center">
									<div>
										<h2 className="text-2xl font-bold text-gray-900">Servers</h2>
										<p className="text-gray-600">Manage your Hetzner Cloud servers</p>
									</div>
									{hasValidApiKeys && (
										<Button>
											<Plus className="w-4 h-4 mr-2" />
											Create Server
										</Button>
									)}
								</div>

								{!hasValidApiKeys ? (
									<Card>
										<CardHeader>
											<CardTitle>API Keys Required</CardTitle>
											<CardDescription>
												Configure your Hetzner and Dokploy API keys to start creating servers.
											</CardDescription>
										</CardHeader>
										<CardContent>
											<Button onClick={() => setActiveTab("settings")}>
												<Settings className="w-4 h-4 mr-2" />
												Configure API Keys
											</Button>
										</CardContent>
									</Card>
								) : (
									<Card>
										<CardContent className="flex flex-col items-center justify-center py-16">
											<Server className="w-16 h-16 text-gray-400 mb-4" />
											<h3 className="text-lg font-medium text-gray-900 mb-2">No servers yet</h3>
											<p className="text-gray-500 text-center mb-6">
												Create your first Hetzner server to deploy WordPress applications.
											</p>
											<Button>
												<Plus className="w-4 h-4 mr-2" />
												Create Your First Server
											</Button>
										</CardContent>
									</Card>
								)}
							</div>
						)}

						{activeTab === "settings" && (
							<div className="space-y-6">
								<div>
									<h2 className="text-2xl font-bold text-gray-900">Settings</h2>
									<p className="text-gray-600">Manage your account settings and API keys</p>
								</div>
								
								<ApiKeyManagement />
							</div>
						)}
					</div>
				</div>
			</Authenticated>
			<Unauthenticated>
				{showSignIn ? (
					<SignInForm onSwitchToSignUp={() => setShowSignIn(false)} />
				) : (
					<SignUpForm onSwitchToSignIn={() => setShowSignIn(true)} />
				)}
			</Unauthenticated>
			<AuthLoading>
				<div className="flex items-center justify-center min-h-screen">
					<div className="text-center">
						<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
						<div>Loading...</div>
					</div>
				</div>
			</AuthLoading>
		</>
	);
}
