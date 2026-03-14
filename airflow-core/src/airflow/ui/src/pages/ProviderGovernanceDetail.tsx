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
import { Link as RouterLink, useParams } from "react-router-dom";

type ProviderStatus = "healthy" | "warning" | "critical";

// Temporary static data; backend will later provide real values based on id.
const SNOWFLAKE_DETAIL = {
  avgResolutionHours: 119,
  healthScore: 54,
  lastRelease: "2024-11-10",
  name: "Snowflake",
  prVolumeMerged: 48,
  prVolumeOpen: 19,
  releases90d: 1,
  status: "warning" as ProviderStatus,
  tag: "area:providers:snowflake",
  totalContributors: 8,
  totalIssuesClosed: 72,
  totalIssuesOpen: 71,
  totalIssuesTotal: 143,
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
  // providerId is currently unused; it is only passed through
  // so the backend can later distinguish providers. For now,
  // all ids render the same static Snowflake view.
  const { providerId } = useParams();
  const provider = SNOWFLAKE_DETAIL;

  const statusBadge = getStatusBadgeProps(provider.status);

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
            <Text fontSize="lg">❄️</Text>
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
                Last release: {provider.lastRelease}
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
          sublabel={`${provider.totalIssuesOpen} open \u00b7 ${provider.totalIssuesClosed} closed`}
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
          sublabel="14 commits (30d)"
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
            <Bar color="red.400" height="80px" label="Issues (Open)" />
            <Bar color="green.400" height="80px" label="Issues (Closed)" />
          </Flex>
          <Flex alignItems="flex-end" gap={4}>
            <Bar color="red.400" height="40px" label="PRs (Open)" />
            <Bar color="blue.400" height="80px" label="PRs (Merged)" />
          </Flex>
        </Flex>
      </Box>

      <Box bg="bg.surface" borderRadius="xl" borderWidth={1} p={4}>
        <Flex alignItems="center" justifyContent="space-between" mb={4}>
          <Heading size="md">Issues ({provider.totalIssuesTotal})</Heading>
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
            <Table.Row>
              <Table.Cell>
                <Link color="fg.info" href="#">
                  #3501
                </Link>
              </Table.Cell>
              <Table.Cell>SnowflakeHook connection pooling broken</Table.Cell>
              <Table.Cell>2024-12-01</Table.Cell>
              <Table.Cell>—</Table.Cell>
              <Table.Cell>
                <Badge borderRadius="full" colorPalette="orange" variant="subtle">
                  Open
                </Badge>
              </Table.Cell>
              <Table.Cell isNumeric>51d</Table.Cell>
            </Table.Row>
            <Table.Row>
              <Table.Cell>
                <Link color="fg.info" href="#">
                  #3287
                </Link>
              </Table.Cell>
              <Table.Cell>COPY INTO fails with special chars</Table.Cell>
              <Table.Cell>2024-11-25</Table.Cell>
              <Table.Cell>—</Table.Cell>
              <Table.Cell>
                <Badge borderRadius="full" colorPalette="orange" variant="subtle">
                  Open
                </Badge>
              </Table.Cell>
              <Table.Cell isNumeric>57d</Table.Cell>
            </Table.Row>
            <Table.Row>
              <Table.Cell>
                <Link color="fg.info" href="#">
                  #3256
                </Link>
              </Table.Cell>
              <Table.Cell>Warehouse auto-resume not triggered</Table.Cell>
              <Table.Cell>2024-11-10</Table.Cell>
              <Table.Cell>2024-12-20</Table.Cell>
              <Table.Cell>
                <Badge borderRadius="full" colorPalette="green" variant="subtle">
                  Closed
                </Badge>
              </Table.Cell>
              <Table.Cell isNumeric>40d</Table.Cell>
            </Table.Row>
          </Table.Body>
        </Table.Root>
      </Box>
    </Box>
  );
};

export default ProviderGovernanceDetail;

