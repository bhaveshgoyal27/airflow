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

import ProviderGovernanceDetail from "./ProviderGovernanceDetail";

vi.mock("src/utils/links", () => ({
  getRedirectPath: (path: string) => `/${path}`,
}));

let mockedProviderId = "1";

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useParams: () => ({ providerId: mockedProviderId }),
  };
});


const detailPayload = {
  issues: [],
  prs: [],
  provider: {
    display_name: "Google",
    id: 1,
    is_active: true,
    lifecycle: "production",
    name: "google",
    steward_email: "owner@example.com",
    tag: "area:providers:google",
  },
  summary: {
    avg_resolution_hours: 24,
    commits_30d: 15,
    contributors: 6,
    health_score: 72.3,
    health_status: "healthy",
    issues_closed: 10,
    issues_open: 4,
    issues_total: 14,
    last_release: null,
    pr_merge_rate: 80,
    prs_closed: 8,
    prs_open: 2,
    prs_total: 10,
  },
};

describe("ProviderGovernanceDetail load states", () => {
  afterEach(() => {
    mockedProviderId = "1";
    vi.restoreAllMocks();
  });

  it("loads and displays provider detail cards", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => detailPayload,
    } as unknown as Response);

    const { findByText } = render(
      <Wrapper>
        <ProviderGovernanceDetail />
      </Wrapper>,
    );

    await findByText("Google");
    await findByText("Health Score");
    await findByText("72.3");
  });

  it("handles invalid providerId path param", async () => {
    mockedProviderId = "not-a-number";
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const { findByText } = render(
      <Wrapper>
        <ProviderGovernanceDetail />
      </Wrapper>,
    );

    await findByText("Provider");
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
