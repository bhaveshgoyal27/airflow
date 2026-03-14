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
import { Badge, Box, Flex, Heading, HStack, Input, NativeSelect, SimpleGrid, Spacer, Table, Text } from "@chakra-ui/react";
import { Link as RouterLink } from "react-router-dom";

const summary = {
  avgResolutionHours: 125,
  contributors: 66,
  critical: 1,
  healthy: 2,
  totalIssues: 762,
  totalProviders: 4,
  warning: 1,
};

const providers = [
  {
    healthScore: 91,
    name: "Google Cloud Platform",
    openIssues: 22,
    prVolume: "17 open",
    tag: "area:providers:google",
  },
  {
    healthScore: 87,
    name: "Amazon Web Services",
    openIssues: 38,
    prVolume: "21 open",
    tag: "apache:airflow",
  },
  {
    healthScore: 54,
    name: "Snowflake",
    openIssues: 27,
    prVolume: "18 open",
    tag: "area:providers:snowflake",
  },
  {
    healthScore: 29,
    name: "Microsoft Azure",
    openIssues: 142,
    prVolume: "34 open",
    tag: "area:providers:azure",
  },
];

// Temporary mapping from provider name to dummy numeric id.
// Backend will later use real ids; for now all detail pages
// render the same static content regardless of id.
const providerIdMap: Record<string, string> = {
  "Google Cloud Platform": "1",
  "Amazon Web Services": "2",
  Snowflake: "3",
  "Microsoft Azure": "4",
};

// Charts removed for now to simplify initial implementation.

const StatCard = ({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string | number;
}) => (
  <Box bg="bg.surface" borderRadius="xl" borderWidth={1} p={4}>
    <Text color="fg.muted" fontSize="xs" textTransform="uppercase">
      {label}
    </Text>
    <Heading mt={2} size="lg">
      {value}
    </Heading>
  </Box>
);

const ProviderRow = ({
  index,
  provider,
}: {
  readonly index: number;
  readonly provider: (typeof providers)[number];
}) => {
  const scoreColor = provider.healthScore >= 80 ? "green" : provider.healthScore >= 50 ? "yellow" : "red";

  return (
    <Table.Row>
      <Table.Cell>{index + 1}</Table.Cell>
      <Table.Cell>
        <RouterLink to={`/provider-governance/${providerIdMap[provider.name] ?? "1"}`}>
          <Text _hover={{ textDecoration: "underline" }} color="fg.info" fontWeight="medium">
            {provider.name}
          </Text>
        </RouterLink>
        <Text color="fg.muted" fontSize="xs">
          {provider.tag}
        </Text>
      </Table.Cell>
      <Table.Cell>
        <Badge borderRadius="full" colorPalette={scoreColor} px={3} py={1} variant="subtle">
          {provider.healthScore}
        </Badge>
      </Table.Cell>
      <Table.Cell>{provider.openIssues}</Table.Cell>
      <Table.Cell>{provider.prVolume}</Table.Cell>
      <Table.Cell>
        <Box as="button" color="fg.info" fontSize="sm">
          View
        </Box>
      </Table.Cell>
    </Table.Row>
  );
};

const ProviderGovernance = () => (
  <Box overflow="auto" px={{ base: 2, md: 4 }} py={4}>
    <Flex alignItems="baseline" justifyContent="space-between" mb={4}>
      <Box>
        <Heading size="lg">Provider Health Overview</Heading>
        <Text color="fg.muted" fontSize="sm" mt={1}>
          Governance dashboard for Apache Airflow providers
        </Text>
        <Text color="fg.muted" fontSize="xs" mt={1}>
          Last updated Jan 21, 2025
        </Text>
      </Box>
      <HStack gap={3}>
        <NativeSelect.Root size="sm" width="180px">
    <NativeSelect.Field>
          <option>Current cycle</option>
        </NativeSelect.Field>
        </NativeSelect.Root>
        <NativeSelect.Root size="sm" width="140px">
  <NativeSelect.Field>
          <option>All tags</option>
        </NativeSelect.Field>
        </NativeSelect.Root>
      </HStack>
    </Flex>

    <SimpleGrid columns={{ base: 2, md: 4 }} gap={4} mb={6}>
      <StatCard label="Total Providers (in this cycle)" value={summary.totalProviders} />
      <StatCard label="Total Issues" value={summary.totalIssues} />
      <StatCard label="Avg Resolution" value={`${summary.avgResolutionHours}h`} />
      <StatCard label="Contributors (last 30d)" value={summary.contributors} />
    </SimpleGrid>

    <SimpleGrid columns={{ base: 1, md: 3 }} gap={4} mb={6}>
      <Box bg="bg.surface" borderRadius="xl" borderWidth={1} p={4}>
        <Text color="fg.muted" fontSize="xs" textTransform="uppercase">
          Health Summary
        </Text>
        <HStack mt={3} spacing={4}>
          <Badge borderRadius="full" colorPalette="green" px={3} py={1} variant="subtle">
            Healthy {summary.healthy}
          </Badge>
          <Badge borderRadius="full" colorPalette="yellow" px={3} py={1} variant="subtle">
            Warning {summary.warning}
          </Badge>
          <Badge borderRadius="full" colorPalette="red" px={3} py={1} variant="subtle">
            Critical {summary.critical}
          </Badge>
        </HStack>
      </Box>
      <Box bg="bg.surface" borderRadius="xl" borderWidth={1} p={4}>
        <Text color="fg.muted" fontSize="xs" textTransform="uppercase">
          Top Best Providers
        </Text>
        <Box mt={3}>
          <HStack justifyContent="space-between">
            <RouterLink to="/provider-governance/1">
              <Text _hover={{ textDecoration: "underline" }} color="fg.info">
                Google Cloud Platform
              </Text>
            </RouterLink>
            <Badge borderRadius="full" colorPalette="green" px={3} py={1} variant="subtle">
              91
            </Badge>
          </HStack>
          <HStack justifyContent="space-between" mt={2}>
            <RouterLink to="/provider-governance/2">
              <Text _hover={{ textDecoration: "underline" }} color="fg.info">
                Amazon Web Services
              </Text>
            </RouterLink>
            <Badge borderRadius="full" colorPalette="green" px={3} py={1} variant="subtle">
              87
            </Badge>
          </HStack>
        </Box>
      </Box>
      <Box bg="bg.surface" borderRadius="xl" borderWidth={1} p={4}>
        <Text color="fg.muted" fontSize="xs" textTransform="uppercase">
          Most At-Risk Providers
        </Text>
        <Box mt={3}>
          <HStack justifyContent="space-between">
            <RouterLink to="/provider-governance/4">
              <Text _hover={{ textDecoration: "underline" }} color="fg.info">
                Microsoft Azure
              </Text>
            </RouterLink>
            <Badge borderRadius="full" colorPalette="red" px={3} py={1} variant="subtle">
              29
            </Badge>
          </HStack>
          <HStack justifyContent="space-between" mt={2}>
            <RouterLink to="/provider-governance/3">
              <Text _hover={{ textDecoration: "underline" }} color="fg.info">
                Snowflake
              </Text>
            </RouterLink>
            <Badge borderRadius="full" colorPalette="yellow" px={3} py={1} variant="subtle">
              54
            </Badge>
          </HStack>
        </Box>
      </Box>
    </SimpleGrid>

    <Box
      bg="bg.surface"
      borderRadius="xl"
      borderWidth={1}
      mb={6}
      p={4}
    >
      <Flex alignItems="center" mb={4}>
        <Heading size="md">All Providers</Heading>
        <Spacer />
        <HStack spacing={3}>
          <Input placeholder="Search providers or tags..." size="sm" width="260px" />
          <NativeSelect.Root size="sm" width="160px">
          <NativeSelect.Field>
            <option>Sort: Health Score</option>
          </NativeSelect.Field>
          </NativeSelect.Root>
        </HStack>
      </Flex>

      <Table.Root size="sm">
        <Table.Header>
          <Table.Row>
            <Table.ColumnHeader>#</Table.ColumnHeader>
            <Table.ColumnHeader>Provider</Table.ColumnHeader>
            <Table.ColumnHeader>Health</Table.ColumnHeader>
            <Table.ColumnHeader>Open Issues</Table.ColumnHeader>
            <Table.ColumnHeader>PR Volume</Table.ColumnHeader>
            <Table.ColumnHeader>Actions</Table.ColumnHeader>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {providers.map((provider, index) => (
            <ProviderRow index={index} key={provider.name} provider={provider} />
          ))}
        </Table.Body>
      </Table.Root>
    </Box>

    <Box bg="bg.surface" borderRadius="xl" borderWidth={1} p={4}>
      <Flex alignItems="center" mb={4}>
        <Heading size="md">Provider Snapshot Comparison</Heading>
      </Flex>
      <Table.Root size="sm">
        <Table.Header>
          <Table.Row>
            <Table.ColumnHeader>Provider</Table.ColumnHeader>
            <Table.ColumnHeader>Score</Table.ColumnHeader>
            <Table.ColumnHeader>Open Issues</Table.ColumnHeader>
            <Table.ColumnHeader>PR Merge Rate</Table.ColumnHeader>
            <Table.ColumnHeader>Commits (30d)</Table.ColumnHeader>
            <Table.ColumnHeader>Releases (365d)</Table.ColumnHeader>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          <Table.Row>
            <Table.Cell>Amazon Web Services</Table.Cell>
            <Table.Cell>67</Table.Cell>
            <Table.Cell>38</Table.Cell>
            <Table.Cell>85%</Table.Cell>
            <Table.Cell>87</Table.Cell>
            <Table.Cell>3</Table.Cell>
          </Table.Row>
          <Table.Row>
            <Table.Cell>Google Cloud Platform</Table.Cell>
            <Table.Cell>91</Table.Cell>
            <Table.Cell>22</Table.Cell>
            <Table.Cell>91%</Table.Cell>
            <Table.Cell>112</Table.Cell>
            <Table.Cell>4</Table.Cell>
          </Table.Row>
          <Table.Row>
            <Table.Cell>Snowflake</Table.Cell>
            <Table.Cell>54</Table.Cell>
            <Table.Cell>27</Table.Cell>
            <Table.Cell>72%</Table.Cell>
            <Table.Cell>34</Table.Cell>
            <Table.Cell>1</Table.Cell>
          </Table.Row>
          <Table.Row>
            <Table.Cell>Microsoft Azure</Table.Cell>
            <Table.Cell>29</Table.Cell>
            <Table.Cell>142</Table.Cell>
            <Table.Cell>63%</Table.Cell>
            <Table.Cell>16</Table.Cell>
            <Table.Cell>0</Table.Cell>
          </Table.Row>
        </Table.Body>
      </Table.Root>
    </Box>
  </Box>
);
export default ProviderGovernance;