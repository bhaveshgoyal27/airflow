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

import ProviderGovernanceDetail from "./ProviderGovernanceDetail";

vi.mock("src/utils/links", () => ({
  getRedirectPath: (path: string) => `/${path}`,
}));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useParams: () => ({ providerId: "1" }),
  };
});


const detailPayload = {
  issues: [
    {
      created: "2026-04-01",
      number: 101,
      resolved: null,
      status: "OPEN",
      title: "Open issue title",
      url: "https://github.com/apache/airflow/issues/101",
    },
    {
      created: "2026-03-01",
      number: 102,
      resolved: "2026-03-10",
      status: "CLOSED",
      title: "Closed issue title",
      url: "https://github.com/apache/airflow/issues/102",
    },
  ],
  prs: [
    {
      created: "2026-04-05",
      number: 201,
      resolved: null,
      status: "OPEN",
      title: "Open PR title",
      url: "https://github.com/apache/airflow/pull/201",
    },
    {
      created: "2026-02-10",
      number: 202,
      resolved: "2026-02-20",
      status: "CLOSED",
      title: "Merged PR title",
      url: "https://github.com/apache/airflow/pull/202",
    },
  ],
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
    issues_closed: 1,
    issues_open: 1,
    issues_total: 2,
    last_release: null,
    pr_merge_rate: 50,
    prs_closed: 1,
    prs_open: 1,
    prs_total: 2,
  },
};

describe("ProviderGovernanceDetail interactions", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("filters issues by search term", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => detailPayload,
    } as unknown as Response);

    const { findByText, getByPlaceholderText, queryByText } = render(
      <Wrapper>
        <ProviderGovernanceDetail />
      </Wrapper>,
    );

    await findByText("Open issue title");
    await findByText("Closed issue title");

    fireEvent.change(getByPlaceholderText("Search issues..."), { target: { value: "closed" } });
    await vi.waitFor(() => expect(queryByText("Open issue title")).toBeNull());
    await findByText("Closed issue title");
  });

  it("filters issues by open/closed status selection", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => detailPayload,
    } as unknown as Response);

    const { findByText, getByDisplayValue, queryByText } = render(
      <Wrapper>
        <ProviderGovernanceDetail />
      </Wrapper>,
    );

    await findByText("Open issue title");
    await findByText("Closed issue title");

    const statusSelect = getByDisplayValue("All Status");
    fireEvent.change(statusSelect, { target: { value: "OPEN" } });
    await vi.waitFor(() => expect(queryByText("Closed issue title")).toBeNull());
    await findByText("Open issue title");
  });
});
