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
import { Badge, Box, Button, Heading, Spinner, Table, Text } from "@chakra-ui/react";
import { useNavigate, useParams } from "react-router-dom";

import { useListProviders, useProviderMetrics, useRefreshProvider } from "src/queries/useProviderGovernance";

const LABEL_COLOR: Record<string, "green" | "yellow" | "red" | "gray"> = {
  "at-risk": "yellow",
  critical: "red",
  healthy: "green",
  unknown: "gray",
};

export const ProviderDetail = () => {
  const { providerId } = useParams<{ providerId: string }>();
  const navigate = useNavigate();
  const id = Number(providerId);

  const { data: collection, isLoading: loadingProviders } = useListProviders();
  const { data: metrics, isLoading: loadingMetrics } = useProviderMetrics(id);
  const { mutate: refreshProvider } = useRefreshProvider();

  if (loadingProviders || loadingMetrics) return <Spinner />;

  const provider = collection?.providers.find((p) => p.id === id);

  if (!provider) return <Text>Provider not found.</Text>;

  return (
    <Box p={4}>
      <Button mb={4} onClick={() => navigate("/provider-governance")} size="sm" variant="ghost">
        ← Back
      </Button>

      <Heading mb={1} size="md">{provider.name}</Heading>
      <Text color="fg.muted" fontSize="sm" mb={4}>{provider.github_path}</Text>

      <Box display="flex" gap={3} mb={6}>
        <Badge colorPalette={LABEL_COLOR[provider.latest_snapshot?.health_label ?? "unknown"]} fontSize="sm">
          {provider.latest_snapshot?.health_label ?? "no data"}
        </Badge>
        <Text fontSize="sm">
          Score: <strong>{provider.latest_snapshot?.health_score.toFixed(1) ?? "—"}</strong>
        </Text>
        <Text color="fg.muted" fontSize="sm">
          Last refreshed: {provider.last_refreshed ? new Date(provider.last_refreshed).toLocaleString() : "Never"}
        </Text>
        <Button
          colorPalette="blue"
          onClick={() => refreshProvider(id)}
          size="xs"
        >
          Refresh Now
        </Button>
      </Box>

      <Heading mb={3} size="sm">Metric History</Heading>
      <Table.Root striped>
        <Table.Header>
          <Table.Row>
            <Table.ColumnHeader>Date</Table.ColumnHeader>
            <Table.ColumnHeader>Score</Table.ColumnHeader>
            <Table.ColumnHeader>Label</Table.ColumnHeader>
            <Table.ColumnHeader>Open PRs</Table.ColumnHeader>
            <Table.ColumnHeader>Merged PRs (30d)</Table.ColumnHeader>
            <Table.ColumnHeader>Open Issues</Table.ColumnHeader>
            <Table.ColumnHeader>Closed Issues (30d)</Table.ColumnHeader>
            <Table.ColumnHeader>Contributors (30d)</Table.ColumnHeader>
            <Table.ColumnHeader>Commits (30d)</Table.ColumnHeader>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {metrics?.map((m) => (
            <Table.Row key={m.id}>
              <Table.Cell>{new Date(m.collected_at).toLocaleString()}</Table.Cell>
              <Table.Cell>{m.health_score.toFixed(1)}</Table.Cell>
              <Table.Cell>
                <Badge colorPalette={LABEL_COLOR[m.health_label]}>{m.health_label}</Badge>
              </Table.Cell>
              <Table.Cell>{m.open_prs}</Table.Cell>
              <Table.Cell>{m.merged_prs_30d}</Table.Cell>
              <Table.Cell>{m.open_issues}</Table.Cell>
              <Table.Cell>{m.closed_issues_30d}</Table.Cell>
              <Table.Cell>{m.unique_contributors_30d}</Table.Cell>
              <Table.Cell>{m.commit_count_30d}</Table.Cell>
            </Table.Row>
          ))}
          {(!metrics || metrics.length === 0) && (
            <Table.Row>
              <Table.Cell colSpan={9} textAlign="center">No metrics yet — click Refresh Now to collect.</Table.Cell>
            </Table.Row>
          )}
        </Table.Body>
      </Table.Root>
    </Box>
  );
};
