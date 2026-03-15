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
import { Badge, Box, Flex, Heading, HStack, Input, Link, SimpleGrid, Spinner, Table, Text } from "@chakra-ui/react";
import axios from "axios";
import { useEffect, useState } from "react";
import { Link as RouterLink, useParams } from "react-router-dom";

type ProviderStatus = "healthy" | "warning" | "critical";

type ProviderDetail = {
  id: number;
  name: string;
  tag: string;
  healthScore: number;
  healthLabel: string;
  openIssues: number;
  totalIssuesClosed: number;
  totalIssuesTotal: number;
  avgResolutionHours: number;
  openPrs: number;
  prVolumeMerged: number;
  prVolumeOpen: number;
  totalContributors: number;
  commitCount30d: number;
  lastRelease: string | null;
};

type IssueRow = {
  id: number;
  title: string;
  created_at: string;
  closed_at: string | null;
  state: string;
  days_active: number;
};

const getStatusBadgeProps = (status: ProviderStatus) => {
  switch (status) {
    case "healthy":
      return { colorPalette: "green", label: "Healthy" };
    case "warning":
      return { colorPalette: "yellow", label: "Warning" };
    case "critical":
      return { colorPalette: "red", label: "Critical" };
    default:
      return { colorPalette: "gray", label: "Unknown" };
  }
};

const StatCard = ({
  label,
  value,
  sublabel,
}: {
  readonly label: string;
  readonly sublabel?: string;
  readonly value: string | number;
}) => (
  <Box bg="bg.surface" borderRadius="xl" borderWidth={1} p={4}>
    <Text color="fg.muted" fontSize="xs" textTransform="uppercase">
      {label}
    </Text>
    <Heading mt={2} size="lg">
      {value}
    </Heading>
    {sublabel ? (
      <Text color="fg.muted" fontSize="xs" mt={1}>
        {sublabel}
      </Text>
    ) : undefined}
  </Box>
);

const Bar = ({
  color,
  height,
  label,
}: {
  readonly color: string;
  readonly height: string;
  readonly label: string;
}) => (
  <Flex alignItems="flex-end" flexDir="column" gap={2}>
    <Box
      bg={color}
      borderRadius="md"
      height={height}
      minWidth="40px"
      width="40px"
    />
    <Text color="fg.muted" fontSize="xs">
      {label}
    </Text>
  </Flex>
);

const GITHUB_ISSUE_URL = "https://github.com/apache/airflow/issues";

const ProviderGovernanceDetail = () => {
  const { providerId } = useParams();
  const [provider, setProvider] = useState<ProviderDetail | null>(null);
  const [issues, setIssues] = useState<IssueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!providerId) return;
    const id = parseInt(providerId, 10);
    if (Number.isNaN(id)) {
      setError("Invalid provider ID");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    Promise.all([
      axios.get<ProviderDetail>(`/ui/provider-governance/providers/${id}`),
      axios.get<{ issues: IssueRow[] }>(`/ui/provider-governance/providers/${id}/issues`),
    ])
      .then(([detailRes, issuesRes]) => {
        setProvider(detailRes.data);
        setIssues(issuesRes.data.issues ?? []);
      })
      .catch((err) => {
        setError(err.response?.status === 404 ? "Provider not found" : err.message ?? "Failed to load");
        setProvider(null);
        setIssues([]);
      })
      .finally(() => setLoading(false));
  }, [providerId]);

  if (loading) {
    return (
      <Box overflow="auto" px={{ base: 2, md: 4 }} py={4}>
        <HStack gap={2}>
          <Spinner size="sm" />
          <Text color="fg.muted">Loading provider…</Text>
        </HStack>
      </Box>
    );
  }
  if (error || !provider) {
    return (
      <Box overflow="auto" px={{ base: 2, md: 4 }} py={4}>
        <Text color="red.500">{error ?? "Provider not found"}</Text>
        <Link asChild color="fg.info" mt={2} display="inline-block">
          <RouterLink to="/provider-governance">Back to Provider Governance</RouterLink>
        </Link>
      </Box>
    );
  }

  const statusBadge = getStatusBadgeProps(provider.healthLabel as ProviderStatus);
  const maxBar = Math.max(
    1,
    provider.openIssues,
    provider.totalIssuesClosed,
    provider.prVolumeOpen,
    provider.prVolumeMerged,
  );
  const bar = (v: number) => `${Math.round((v / maxBar) * 80)}px`;

  return (
    <Box overflow="auto" px={{ base: 2, md: 4 }} py={4}>
      <Text color="fg.muted" fontSize="xs" mb={2}>
        <Link asChild color="fg.muted">
          <RouterLink to="/provider-governance">Provider Governance</RouterLink>
        </Link>{" "}
        / {provider.name}
      </Text>

      <Flex alignItems={{ base: "flex-start", md: "center" }} justifyContent="space-between" mb={6}>
        <HStack alignItems="center" gap={4}>
          <Box
            alignItems="center"
            borderRadius="full"
            borderWidth={1}
            boxSize={12}
            display="flex"
            justifyContent="center"
          >
            <Text fontSize="lg">{provider.tag.slice(0, 2).toUpperCase()}</Text>
          </Box>
          <Box>
            <Heading size="lg">{provider.name}</Heading>
            <HStack gap={2} mt={2}>
              <Badge borderRadius="full" colorPalette="blue" variant="subtle">
                {provider.tag}
              </Badge>
              <Badge borderRadius="full" colorPalette={statusBadge.colorPalette} variant="subtle">
                {statusBadge.label}
              </Badge>
              <Text color="fg.muted" fontSize="xs">
                Last release: {provider.lastRelease ?? "—"}
              </Text>
            </HStack>
          </Box>
        </HStack>
        <HStack gap={3} mt={{ base: 4, md: 0 }}>
          <Box
            as="button"
            borderRadius="lg"
            borderWidth={1}
            color="fg.muted"
            fontSize="sm"
            px={4}
            py={2}
          >
            Email Steward
          </Box>
          <Box
            as="button"
            bg="blue.500"
            borderRadius="lg"
            color="white"
            fontSize="sm"
            px={4}
            py={2}
          >
            Download Report
          </Box>
        </HStack>
      </Flex>

      <SimpleGrid columns={{ base: 2, md: 5 }} gap={4} mb={6}>
        <StatCard label="Health Score" value={provider.healthScore} sublabel={statusBadge.label} />
        <StatCard
          label="Total Issues"
          value={provider.totalIssuesTotal}
          sublabel={`${provider.openIssues} open \u00b7 ${provider.totalIssuesClosed} closed`}
        />
        <StatCard label="Avg Resolution" value={`${provider.avgResolutionHours}h`} />
        <StatCard
          label="PR Volume"
          value={provider.prVolumeMerged + provider.prVolumeOpen}
          sublabel={`${provider.prVolumeMerged} merged \u00b7 ${provider.prVolumeOpen} open`}
        />
        <StatCard
          label="Contributors"
          value={provider.totalContributors}
          sublabel={`${provider.commitCount30d} commits (30d)`}
        />
      </SimpleGrid>

      <Box bg="bg.surface" borderRadius="xl" borderWidth={1} mb={6} p={4}>
        <Text color="fg.muted" fontSize="xs" mb={4} textTransform="uppercase">
          Issue &amp; PR Volume
        </Text>
        <Flex
          alignItems="flex-end"
          gap={8}
          justifyContent="center"
          minH="220px"
        >
          <Flex alignItems="flex-end" gap={4}>
            <Bar color="red.400" height={bar(provider.openIssues)} label="Issues (Open)" />
            <Bar color="green.400" height={bar(provider.totalIssuesClosed)} label="Issues (Closed)" />
          </Flex>
          <Flex alignItems="flex-end" gap={4}>
            <Bar color="red.400" height={bar(provider.prVolumeOpen)} label="PRs (Open)" />
            <Bar color="blue.400" height={bar(provider.prVolumeMerged)} label="PRs (Merged)" />
          </Flex>
        </Flex>
      </Box>

      <Box bg="bg.surface" borderRadius="xl" borderWidth={1} p={4}>
        <Flex alignItems="center" justifyContent="space-between" mb={4}>
          <Heading size="md">Issues ({issues.length})</Heading>
          <HStack gap={3}>
            <Input placeholder="Search issues..." size="sm" width="260px" />
            <Box
              as="button"
              borderRadius="lg"
              borderWidth={1}
              fontSize="sm"
              px={3}
              py={1.5}
            >
              All Status
            </Box>
          </HStack>
        </Flex>
        <Table.Root size="sm">
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeader>ID</Table.ColumnHeader>
              <Table.ColumnHeader>Title</Table.ColumnHeader>
              <Table.ColumnHeader>Created</Table.ColumnHeader>
              <Table.ColumnHeader>Resolved</Table.ColumnHeader>
              <Table.ColumnHeader>Status</Table.ColumnHeader>
              <Table.ColumnHeader isNumeric>Days Active</Table.ColumnHeader>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {issues.map((issue) => (
              <Table.Row key={issue.id}>
                <Table.Cell>
                  <Link color="fg.info" href={`${GITHUB_ISSUE_URL}/${issue.id}`} target="_blank" rel="noopener noreferrer">
                    #{issue.id}
                  </Link>
                </Table.Cell>
                <Table.Cell>{issue.title}</Table.Cell>
                <Table.Cell>{issue.created_at}</Table.Cell>
                <Table.Cell>{issue.closed_at ?? "—"}</Table.Cell>
                <Table.Cell>
                  <Badge
                    borderRadius="full"
                    colorPalette={issue.state === "open" ? "orange" : "green"}
                    variant="subtle"
                  >
                    {issue.state === "open" ? "Open" : "Closed"}
                  </Badge>
                </Table.Cell>
                <Table.Cell isNumeric>{issue.days_active}d</Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>
      </Box>
    </Box>
  );
};

export default ProviderGovernanceDetail;

