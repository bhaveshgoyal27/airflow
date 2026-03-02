/*!
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

const BASE = "/api/v2/providerGovernance";

export type MetricSnapshot = {
  id: number;
  provider_id: number;
  collected_at: string;
  open_prs: number;
  merged_prs_30d: number;
  avg_pr_review_latency_hours: number;
  open_issues: number;
  closed_issues_30d: number;
  avg_issue_age_days: number;
  unique_contributors_30d: number;
  commit_count_30d: number;
  health_score: number;
  health_label: "healthy" | "at-risk" | "critical" | "unknown";
};

export type Provider = {
  id: number;
  name: string;
  github_path: string;
  last_refreshed: string | null;
  latest_snapshot: MetricSnapshot | null;
};

export type ProviderCollection = {
  providers: Provider[];
  total_entries: number;
};

const apiFetch = async (path: string, options?: RequestInit) => {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) throw new Error(await res.text());
  if (res.status === 204) return null;
  return res.json();
};

export const PROVIDERS_KEY = "providerGovernance";

export const useListProviders = () =>
  useQuery<ProviderCollection>({
    queryFn: () => apiFetch(BASE),
    queryKey: [PROVIDERS_KEY],
  });

export const useProviderMetrics = (providerId: number) =>
  useQuery<MetricSnapshot[]>({
    queryFn: () => apiFetch(`${BASE}/${providerId}/metrics`),
    queryKey: [PROVIDERS_KEY, providerId, "metrics"],
  });

export const useCreateProvider = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: { name: string; github_path: string }) =>
      apiFetch(BASE, { body: JSON.stringify(body), method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [PROVIDERS_KEY] }),
  });
};

export const useRefreshProvider = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (providerId: number) =>
      apiFetch(`${BASE}/${providerId}/refresh`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [PROVIDERS_KEY] }),
  });
};
