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
import { fireEvent, render } from "@testing-library/react";
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
  {
    avg_resolution_hours: 10,
    commits_30d: 8,
    contributors: 4,
    health_score: 33.1,
    health_status: "critical",
    issues_closed: 2,
    issues_open: 20,
    issues_total: 22,
    pr_merge_rate: 10,
    prs_closed: 1,
    prs_open: 8,
    prs_total: 9,
    provider_id: 2,
  },
];

describe("ProviderGovernance filters and sort", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("filters providers by search query", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(asResponse(providers) as unknown as Response)
      .mockResolvedValueOnce(asResponse(summaryRows) as unknown as Response);

    const { findAllByText, getByPlaceholderText } = render(
      <Wrapper>
        <ProviderGovernance />
      </Wrapper>,
    );

    const initialGoogleCount = (await findAllByText("Google")).length;
    expect(initialGoogleCount).toBeGreaterThan(0);
    expect((await findAllByText("Amazon")).length).toBeGreaterThan(0);

    fireEvent.change(getByPlaceholderText("Search by name or lifecycle..."), {
      target: { value: "amazon" },
    });

    await vi.waitFor(async () =>
      expect((await findAllByText("Google")).length).toBeLessThan(initialGoogleCount),
    );
    expect((await findAllByText("Amazon")).length).toBeGreaterThan(0);
  });

  it("sort selector accepts open_issues ordering option", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(asResponse(providers) as unknown as Response)
      .mockResolvedValueOnce(asResponse(summaryRows) as unknown as Response);

    const { findAllByText, getByDisplayValue } = render(
      <Wrapper>
        <ProviderGovernance />
      </Wrapper>,
    );
    expect((await findAllByText("Google")).length).toBeGreaterThan(0);

    const select = getByDisplayValue("Sort: Health Score");
    fireEvent.change(select, { target: { value: "open_issues" } });
    await vi.waitFor(() => expect(getByDisplayValue("Sort: Open Issues")).toBeInTheDocument());
  });
});
