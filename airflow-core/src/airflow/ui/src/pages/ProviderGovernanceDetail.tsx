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
import { Badge, Box, Flex, Heading, HStack, Input, Link, SimpleGrid, Table, Text } from "@chakra-ui/react";
import { useEffect, useMemo, useState } from "react";
import { Link as RouterLink, useParams } from "react-router-dom";
import { toaster } from "src/components/ui";
import { getRedirectPath } from "src/utils/links";

type ProviderStatus = "healthy" | "warning" | "critical";

type ApiProvider = {
  readonly display_name: string;
  readonly id: number;
  readonly is_active: boolean;
  readonly lifecycle: string;
  readonly name: string;
  readonly steward_email: string;
  readonly tag: string;
};

type ApiIssueRow = {
  readonly created: string; // YYYY-MM-DD
  readonly number: number | null;
  readonly resolved: string | null; // YYYY-MM-DD
  readonly status: "OPEN" | "CLOSED";
  readonly title: string;
  readonly url: string;
};

type ApiPRRow = {
  readonly created: string; // YYYY-MM-DD
  readonly number: number | null;
  readonly resolved: string | null; // YYYY-MM-DD
  readonly status: "OPEN" | "CLOSED";
  readonly title: string;
  readonly url: string;
};

type ApiProviderDetail = {
  readonly issues: Array<ApiIssueRow>;
  readonly prs: Array<ApiPRRow>;
  readonly provider: ApiProvider;
  readonly summary: {
    readonly avg_resolution_hours: number | null;
    readonly commits_30d: number;
    readonly contributors: number;
    readonly issues_closed: number;
    readonly issues_open: number;
    readonly issues_total: number;
    readonly last_release: string | null;
    readonly prs_closed: number;
    readonly prs_open: number;
    readonly prs_total: number;
  };
};

const getDummyHealthScore = (provider: ApiProvider): number => {
  const seed = provider.id * 9973 + provider.name.length * 7919;
  return seed % 101;
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

const ProviderGovernanceDetail = () => {
  const { providerId } = useParams();
  const [data, setData] = useState<ApiProviderDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const id = Number(providerId);
    if (!providerId || Number.isNaN(id)) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const origin = window.location.origin;
    void fetch(`${origin}${getRedirectPath(`ui/provider-governance/providers/${id}/detail`)}`)
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error((err as { detail?: string })?.detail ?? "Failed to load provider details");
        }
        return (await res.json()) as ApiProviderDetail;
      })
      .then((payload) => setData(payload))
      .catch((err) => {
        toaster.create({
          title: "Could not load provider details",
          description: err instanceof Error ? err.message : "Unknown error",
          type: "error",
        });
      })
      .finally(() => setIsLoading(false));
  }, [providerId]);

  const provider = data?.provider;
  const summary = data?.summary;

  const healthScore = useMemo(() => (provider ? getDummyHealthScore(provider) : 0), [provider]);
  const status: ProviderStatus = healthScore >= 70 ? "healthy" : healthScore >= 40 ? "warning" : "critical";
  const statusBadge = getStatusBadgeProps(status);

  const issues = data?.issues ?? [];
  const prs = data?.prs ?? [];

  const prVolumeOpen = summary?.prs_open ?? 0;
  const prVolumeMerged = summary?.prs_closed ?? 0;
  const totalIssuesTotal = summary?.issues_total ?? 0;
  const totalIssuesOpen = summary?.issues_open ?? 0;
  const totalIssuesClosed = summary?.issues_closed ?? 0;
  const avgResolutionHours = summary?.avg_resolution_hours ?? 0;
  const avgResolutionDays = Math.round(avgResolutionHours / 24);

  const chartMax = Math.max(totalIssuesOpen, totalIssuesClosed, prVolumeOpen, prVolumeMerged, 1);
  const toHeight = (value: number) => `${Math.max(24, Math.round((value / chartMax) * 160))}px`;

  const shownName = provider?.display_name ?? "Provider";
  const lastRelease = summary?.last_release ?? "—";
  const totalContributors = summary?.contributors ?? 0;
  const commits30d = summary?.commits_30d ?? 0;

  return (
    <Box overflow="auto" px={{ base: 2, md: 4 }} py={4}>
      <Text color="fg.muted" fontSize="xs" mb={2}>
        <Link asChild color="fg.muted">
          <RouterLink to="/provider-governance">Provider Governance</RouterLink>
        </Link>{" "}
        / {shownName}
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
            <Text fontSize="lg">❄️</Text>
          </Box>
          <Box>
            <Heading size="lg">{shownName}</Heading>
            <HStack gap={2} mt={2}>
              <Badge borderRadius="full" colorPalette="blue" variant="subtle">
                {provider?.tag ?? "—"}
              </Badge>
              <Badge borderRadius="full" colorPalette={statusBadge.colorPalette} variant="subtle">
                {statusBadge.label}
              </Badge>
              <Text color="fg.muted" fontSize="xs">
                Last release: {lastRelease}
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
        <StatCard
          label="Health Score"
          value={isLoading ? "—" : healthScore}
          sublabel={isLoading ? undefined : statusBadge.label}
        />
        <StatCard
          label="Total Issues"
          value={isLoading ? "—" : totalIssuesTotal}
          sublabel={isLoading ? undefined : `${totalIssuesOpen} open \u00b7 ${totalIssuesClosed} closed`}
        />
        <StatCard label="Avg Resolution (days)" value={isLoading ? "—" : `${avgResolutionDays}d`} />
        <StatCard
          label="PR Volume"
          value={isLoading ? "—" : prVolumeMerged + prVolumeOpen}
          sublabel={isLoading ? undefined : `${prVolumeMerged} merged \u00b7 ${prVolumeOpen} open`}
        />
        <StatCard
          label="Contributors"
          value={isLoading ? "—" : totalContributors}
          sublabel={isLoading ? undefined : `${commits30d} commits (30d)`}
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
            <Bar color="red.400" height={toHeight(totalIssuesOpen)} label="Issues (Open)" />
            <Bar color="green.400" height={toHeight(totalIssuesClosed)} label="Issues (Closed)" />
          </Flex>
          <Flex alignItems="flex-end" gap={4}>
            <Bar color="red.400" height={toHeight(prVolumeOpen)} label="PRs (Open)" />
            <Bar color="blue.400" height={toHeight(prVolumeMerged)} label="PRs (Merged)" />
          </Flex>
        </Flex>
      </Box>

      <Box bg="bg.surface" borderRadius="xl" borderWidth={1} p={4}>
        <Flex alignItems="center" justifyContent="space-between" mb={4}>
          <Heading size="md">Issues ({totalIssuesTotal})</Heading>
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
            {isLoading ? (
              <Table.Row>
                <Table.Cell colSpan={6}>
                  <Text color="fg.muted">Loading…</Text>
                </Table.Cell>
              </Table.Row>
            ) : issues.length === 0 ? (
              <Table.Row>
                <Table.Cell colSpan={6}>
                  <Text color="fg.muted">No issues synced yet. Click “Refresh metrics” on the overview page.</Text>
                </Table.Cell>
              </Table.Row>
            ) : (
              issues.slice(0, 200).map((issue) => {
                const created = issue.created;
                const resolved = issue.resolved ?? "—";
                const badge = issue.status === "OPEN" ? { colorPalette: "orange", label: "Open" } : { colorPalette: "green", label: "Closed" };
                const createdDate = new Date(`${issue.created}T00:00:00Z`);
                const endDate = new Date(`${(issue.resolved ?? issue.created)}T00:00:00Z`);
                const daysActive = Math.max(0, Math.round((endDate.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24)));
                const displayNum = issue.number ? `#${issue.number}` : "—";
                return (
                  <Table.Row key={`${issue.url}`}>
                    <Table.Cell>
                      <Link color="fg.info" href={issue.url} target="_blank">
                        {displayNum}
                      </Link>
                    </Table.Cell>
                    <Table.Cell>{issue.title}</Table.Cell>
                    <Table.Cell>{created}</Table.Cell>
                    <Table.Cell>{resolved}</Table.Cell>
                    <Table.Cell>
                      <Badge borderRadius="full" colorPalette={badge.colorPalette} variant="subtle">
                        {badge.label}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell isNumeric>{daysActive}d</Table.Cell>
                  </Table.Row>
                );
              })
            )}
          </Table.Body>
        </Table.Root>
      </Box>
    </Box>
  );
};

export default ProviderGovernanceDetail;

