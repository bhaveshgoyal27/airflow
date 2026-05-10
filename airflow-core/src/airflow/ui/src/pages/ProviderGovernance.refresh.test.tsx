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
import "@testing-library/jest-dom";
import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Wrapper } from "src/utils/Wrapper";

import ProviderGovernance from "./ProviderGovernance";

vi.mock("src/utils/links", () => ({
  getRedirectPath: (path: string) => `/${path}`,
}));

type JsonResponse = {
  ok: boolean;
  json: () => Promise<unknown>;
};

const asResponse = (body: unknown, ok = true): JsonResponse => ({
  ok,
  json: async () => body,
});

const providers = [
  {
    display_name: "Google",
    id: 1,
    is_active: true,
    lifecycle: "production",
    name: "google",
    steward_email: "owner@example.com",
  },
  {
    display_name: "Amazon",
    id: 2,
    is_active: true,
    lifecycle: "production",
    name: "amazon",
    steward_email: "owner2@example.com",
  },
];

const summaryRows = [
  {
    avg_resolution_hours: 24,
    commits_30d: 15,
    contributors: 6,
    health_score: 72.3,
    health_status: "healthy",
    issues_closed: 10,
    issues_open: 4,
    issues_total: 14,
    pr_merge_rate: 80,
    prs_closed: 8,
    prs_open: 2,
    prs_total: 10,
    provider_id: 1,
  },
];

describe("ProviderGovernance refresh behavior", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("refresh metrics calls sync endpoints for each provider", async () => {
    const calls: Array<string> = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input: URL | RequestInfo) => {
      const url = String(input);
      calls.push(url);
      if (url.endsWith("/ui/provider-governance/providers/summary")) {
        return asResponse(summaryRows) as unknown as Response;
      }
      if (url.endsWith("/ui/provider-governance/providers")) {
        return asResponse(providers) as unknown as Response;
      }
      if (url.includes("/ui/provider-governance/sync/") || url.includes("/ui/provider-governance/sync-pr/")) {
        return asResponse({ added: 1, unchanged: 0, updated: 0 }) as unknown as Response;
      }
      return asResponse({ detail: "unexpected call" }, false) as unknown as Response;
    });

    const { findAllByText, getByRole } = render(
      <Wrapper>
        <ProviderGovernance />
      </Wrapper>,
    );

    expect((await findAllByText("Google")).length).toBeGreaterThan(0);
    getByRole("button", { name: /refresh metrics/i }).click();

    await vi.waitFor(() =>
      expect(calls).toEqual(
        expect.arrayContaining([
          "http://localhost:3000/ui/provider-governance/sync/1",
          "http://localhost:3000/ui/provider-governance/sync-pr/1",
          "http://localhost:3000/ui/provider-governance/sync/2",
          "http://localhost:3000/ui/provider-governance/sync-pr/2",
        ]),
      ),
    );
  });

  it("stops refresh sequence when issue sync returns non-OK", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input: URL | RequestInfo) => {
      const url = String(input);
      if (url.endsWith("/ui/provider-governance/providers")) {
        return asResponse([providers[0]]) as unknown as Response;
      }
      if (url.endsWith("/ui/provider-governance/providers/summary")) {
        return asResponse(summaryRows) as unknown as Response;
      }
      if (url.endsWith("/ui/provider-governance/sync/1")) {
        return asResponse({ detail: "Issue sync failed for Google" }, false) as unknown as Response;
      }
      return asResponse({ added: 1, unchanged: 0, updated: 0 }) as unknown as Response;
    });

    const { findAllByText, getByRole } = render(
      <Wrapper>
        <ProviderGovernance />
      </Wrapper>,
    );

    expect((await findAllByText("Google")).length).toBeGreaterThan(0);
    getByRole("button", { name: /refresh metrics/i }).click();

    await vi.waitFor(() => {
      const fetchCalls = (globalThis.fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls;
      expect(
        fetchCalls.some(
          ([url, init]) =>
            String(url) === "http://localhost:3000/ui/provider-governance/sync/1" &&
            JSON.stringify(init) === JSON.stringify({ method: "POST" }),
        ),
      ).toBe(true);
    });
  });
});
