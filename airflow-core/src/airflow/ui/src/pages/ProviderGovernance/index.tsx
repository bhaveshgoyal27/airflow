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
import { Badge, Box, Button, Heading, Spinner, Table } from "@chakra-ui/react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { useCreateProvider, useListProviders, useRefreshProvider } from "src/queries/useProviderGovernance";

const LABEL_COLOR: Record<string, "green" | "yellow" | "red" | "gray"> = {
  "at-risk": "yellow",
  critical: "red",
  healthy: "green",
  unknown: "gray",
};

export const ProviderGovernance = () => {
  const navigate = useNavigate();
  const { data, isLoading } = useListProviders();
  const { mutate: createProvider } = useCreateProvider();
  const { mutate: refreshProvider } = useRefreshProvider();

  const [newName, setNewName] = useState("");
  const [newPath, setNewPath] = useState("");

  if (isLoading) return <Spinner />;

  return (
    <Box p={4}>
      <Heading mb={4} size="md">Provider Governance Dashboard</Heading>

      {/* Add provider form */}
      <Box display="flex" gap={2} mb={6}>
        <input
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Provider name (e.g. amazon)"
          style={{ border: "1px solid #ccc", borderRadius: 4, padding: "6px 10px", width: 220 }}
          value={newName}
        />
        <input
          onChange={(e) => setNewPath(e.target.value)}
          placeholder="GitHub path (e.g. providers/amazon)"
          style={{ border: "1px solid #ccc", borderRadius: 4, padding: "6px 10px", width: 260 }}
          value={newPath}
        />
        <Button
          colorPalette="blue"
          disabled={!newName || !newPath}
          onClick={() => {
            createProvider({ github_path: newPath, name: newName });
            setNewName("");
            setNewPath("");
          }}
          size="sm"
        >
          Add Provider
        </Button>
      </Box>

      <Table.Root striped>
        <Table.Header>
          <Table.Row>
            <Table.ColumnHeader>Provider</Table.ColumnHeader>
            <Table.ColumnHeader>Health</Table.ColumnHeader>
            <Table.ColumnHeader>Score</Table.ColumnHeader>
            <Table.ColumnHeader>Open Issues</Table.ColumnHeader>
            <Table.ColumnHeader>Open PRs</Table.ColumnHeader>
            <Table.ColumnHeader>Contributors (30d)</Table.ColumnHeader>
            <Table.ColumnHeader>Last Refreshed</Table.ColumnHeader>
            <Table.ColumnHeader>Actions</Table.ColumnHeader>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {data?.providers.map((p) => (
            <Table.Row
              cursor="pointer"
              key={p.id}
              onClick={() => navigate(`/provider-governance/${p.id}`)}
            >
              <Table.Cell fontWeight="bold">{p.name}</Table.Cell>
              <Table.Cell>
                <Badge colorPalette={LABEL_COLOR[p.latest_snapshot?.health_label ?? "unknown"]}>
                  {p.latest_snapshot?.health_label ?? "no data"}
                </Badge>
              </Table.Cell>
              <Table.Cell>{p.latest_snapshot?.health_score.toFixed(1) ?? "—"}</Table.Cell>
              <Table.Cell>{p.latest_snapshot?.open_issues ?? "—"}</Table.Cell>
              <Table.Cell>{p.latest_snapshot?.open_prs ?? "—"}</Table.Cell>
              <Table.Cell>{p.latest_snapshot?.unique_contributors_30d ?? "—"}</Table.Cell>
              <Table.Cell>
                {p.last_refreshed ? new Date(p.last_refreshed).toLocaleString() : "Never"}
              </Table.Cell>
              <Table.Cell>
                <Button
                  colorPalette="gray"
                  onClick={(e) => {
                    e.stopPropagation();
                    refreshProvider(p.id);
                  }}
                  size="xs"
                >
                  Refresh
                </Button>
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table.Root>
    </Box>
  );
};
