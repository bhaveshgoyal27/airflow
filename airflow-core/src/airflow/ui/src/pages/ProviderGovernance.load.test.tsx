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

describe("ProviderGovernance load states", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders provider health from summary endpoint data", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(asResponse(providers) as unknown as Response)
      .mockResolvedValueOnce(asResponse(summaryRows) as unknown as Response);

    const { findAllByText, findByText } = render(
      <Wrapper>
        <ProviderGovernance />
      </Wrapper>,
    );

    expect((await findAllByText("Google")).length).toBeGreaterThan(0);
    await findByText("Healthy");
    await findByText("Total Providers (in this cycle)");
  });

  it("shows empty-state text when providers list is empty", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(asResponse([]) as unknown as Response)
      .mockResolvedValueOnce(asResponse([]) as unknown as Response);

    const { findByText } = render(
      <Wrapper>
        <ProviderGovernance />
      </Wrapper>,
    );

    await findByText('No providers yet. Click "Add provider" to register one.');
  });

  it("shows N/A status when provider has no summary row", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(asResponse(providers) as unknown as Response)
      .mockResolvedValueOnce(asResponse([]) as unknown as Response);

    const { findAllByText, findByText } = render(
      <Wrapper>
        <ProviderGovernance />
      </Wrapper>,
    );

    expect((await findAllByText("Google")).length).toBeGreaterThan(0);
    await findByText("N/A");
  });
});
