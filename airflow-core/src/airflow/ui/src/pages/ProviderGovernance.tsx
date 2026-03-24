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
import {
  Badge,
  Box,
  Button,
  Field,
  Flex,
  Heading,
  HStack,
  Input,
  NativeSelect,
  SimpleGrid,
  Spacer,
  Stack,
  Table,
  Text,
} from "@chakra-ui/react";
import { useCallback, useEffect, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import { Checkbox } from "src/components/ui/Checkbox";
import { Dialog, toaster } from "src/components/ui";
import { getRedirectPath } from "src/utils/links";

type ApiProvider = {
  readonly display_name: string;
  readonly id: number;
  readonly is_active: boolean;
  readonly lifecycle: string;
  readonly name: string;
  readonly steward_email: string;
};

/** Placeholder summary until metrics are aggregated in the API. */
const summary = {
  avgResolutionHours: 125,
  contributors: 66,
  critical: 1,
  healthy: 2,
  totalIssues: 762,
  warning: 1,
};

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
  readonly provider: ApiProvider;
}) => (
  <Table.Row>
    <Table.Cell>{index + 1}</Table.Cell>
    <Table.Cell>
      <RouterLink to={`/provider-governance/${provider.id}`}>
        <Text _hover={{ textDecoration: "underline" }} color="fg.info" fontWeight="medium">
          {provider.display_name}
        </Text>
      </RouterLink>
      <Text color="fg.muted" fontSize="xs">
        {provider.name} · {provider.lifecycle}
      </Text>
    </Table.Cell>
    <Table.Cell>
      <Badge borderRadius="full" colorPalette="gray" px={3} py={1} variant="subtle">
        —
      </Badge>
    </Table.Cell>
    <Table.Cell>—</Table.Cell>
    <Table.Cell>—</Table.Cell>
    <Table.Cell>
      <Box as="button" color="fg.info" fontSize="sm">
        View
      </Box>
    </Table.Cell>
  </Table.Row>
);

const ProviderGovernance = () => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [providersList, setProvidersList] = useState<Array<ApiProvider>>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formName, setFormName] = useState("");
  const [formDisplayName, setFormDisplayName] = useState("");
  const [formLifecycle, setFormLifecycle] = useState("production");
  const [formActive, setFormActive] = useState(true);
  const [formStewardEmail, setFormStewardEmail] = useState("bg487@cornell.edu");

  const loadProviders = useCallback(async () => {
    const origin = window.location.origin;
    const res = await fetch(`${origin}${getRedirectPath("ui/provider-governance/providers")}`);
    if (!res.ok) {
      throw new Error("Failed to load providers");
    }
    const data = (await res.json()) as Array<ApiProvider>;
    setProvidersList(data);
  }, []);

  useEffect(() => {
    void loadProviders().catch(() => {
      toaster.create({
        title: "Could not load providers",
        description: "Check that the API is available.",
        type: "error",
      });
    });
  }, [loadProviders]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    const origin = window.location.origin;
    try {
      const providersRes = await fetch(
        `${origin}${getRedirectPath("ui/provider-governance/providers")}`,
      );
      if (!providersRes.ok) {
        throw new Error("Failed to fetch providers");
      }
      const list: Array<ApiProvider> = await providersRes.json();
      for (const provider of list) {
        const syncRes = await fetch(
          `${origin}${getRedirectPath(`ui/provider-governance/sync/${provider.id}`)}`,
          { method: "POST" },
        );
        if (!syncRes.ok) {
          const err = await syncRes.json().catch(() => ({}));
          throw new Error(
            (err as { detail?: string })?.detail ??
              `Issue sync failed for ${provider.display_name}`,
          );
        }
        const prRes = await fetch(
          `${origin}${getRedirectPath(`ui/provider-governance/sync-pr/${provider.id}`)}`,
          { method: "POST" },
        );
        if (!prRes.ok) {
          const err = await prRes.json().catch(() => ({}));
          throw new Error(
            (err as { detail?: string })?.detail ??
              `PR sync failed for ${provider.display_name}`,
          );
        }
      }
      await loadProviders();
      toaster.create({
        title: "Refresh complete",
        description: `Synced issues and PRs for ${list.length} provider(s).`,
        type: "success",
      });
    } catch (err) {
      toaster.create({
        title: "Refresh failed",
        description: err instanceof Error ? err.message : "Unknown error",
        type: "error",
      });
    } finally {
      setIsRefreshing(false);
    }
  }, [loadProviders]);

  const handleAddProvider = async () => {
    const name = formName.trim();
    const displayName = formDisplayName.trim();
    if (!name || !displayName) {
      toaster.create({
        title: "Missing fields",
        description: "Name and display name are required.",
        type: "error",
      });
      return;
    }
    setIsSaving(true);
    const origin = window.location.origin;
    try {
      const res = await fetch(`${origin}${getRedirectPath("ui/provider-governance/providers")}`, {
        body: JSON.stringify({
          display_name: displayName,
          is_active: formActive,
          lifecycle: formLifecycle,
          name,
          steward_email: formStewardEmail.trim() || "bg487@cornell.edu",
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { detail?: string })?.detail ?? "Failed to create provider");
      }
      toaster.create({
        title: "Provider added",
        description: displayName,
        type: "success",
      });
      setAddOpen(false);
      setFormName("");
      setFormDisplayName("");
      setFormLifecycle("production");
      setFormActive(true);
      setFormStewardEmail("bg487@cornell.edu");
      await loadProviders();
    } catch (err) {
      toaster.create({
        title: "Could not add provider",
        description: err instanceof Error ? err.message : "Unknown error",
        type: "error",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const totalProviders = providersList.length;
  const topTwo = providersList.slice(0, 2);
  const atRiskTwo = providersList.length >= 2 ? providersList.slice(-2) : [];

  return (
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
        <HStack gap={3} flexWrap="wrap" justifyContent="flex-end">
          <Button onClick={() => setAddOpen(true)} size="sm" variant="solid">
            Add provider
          </Button>
          <Button loading={isRefreshing} onClick={handleRefresh} size="sm" variant="outline">
            Refresh metrics
          </Button>
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

      <Dialog.Root onOpenChange={(d) => setAddOpen(d.open)} open={addOpen} size="lg">
        <Dialog.Content backdrop>
          <Dialog.Header>
            <Heading size="lg">Add provider</Heading>
          </Dialog.Header>
          <Dialog.CloseTrigger />
          <Dialog.Body>
            <Stack gap={4}>
              <Field.Root required>
                <Field.Label>Name (unique key)</Field.Label>
                <Input
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. google"
                  value={formName}
                />
              </Field.Root>
              <Field.Root required>
                <Field.Label>Display name</Field.Label>
                <Input
                  onChange={(e) => setFormDisplayName(e.target.value)}
                  placeholder="e.g. Google Cloud Platform"
                  value={formDisplayName}
                />
              </Field.Root>
              <Field.Root>
                <Field.Label>Lifecycle</Field.Label>
                <NativeSelect.Root>
                  <NativeSelect.Field
                    onChange={(e) => setFormLifecycle(e.target.value)}
                    value={formLifecycle}
                  >
                    <option value="incubation">incubation</option>
                    <option value="production">production</option>
                    <option value="mature">mature</option>
                    <option value="deprecated">deprecated</option>
                  </NativeSelect.Field>
                </NativeSelect.Root>
              </Field.Root>
              <Field.Root>
                <Checkbox checked={formActive} onChange={() => setFormActive(!formActive)} size="sm">
                  Active
                </Checkbox>
              </Field.Root>
              <Field.Root>
                <Field.Label>Steward email</Field.Label>
                <Input
                  onChange={(e) => setFormStewardEmail(e.target.value)}
                  type="email"
                  value={formStewardEmail}
                />
              </Field.Root>
            </Stack>
          </Dialog.Body>
          <Dialog.Footer>
            <Button loading={isSaving} onClick={handleAddProvider}>
              Save
            </Button>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Root>

      <SimpleGrid columns={{ base: 2, md: 4 }} gap={4} mb={6}>
        <StatCard label="Total Providers (in this cycle)" value={totalProviders} />
        <StatCard label="Total Issues" value={summary.totalIssues} />
        <StatCard label="Avg Resolution" value={`${summary.avgResolutionHours}h`} />
        <StatCard label="Contributors (last 30d)" value={summary.contributors} />
      </SimpleGrid>

      <SimpleGrid columns={{ base: 1, md: 3 }} gap={4} mb={6}>
        <Box bg="bg.surface" borderRadius="xl" borderWidth={1} p={4}>
          <Text color="fg.muted" fontSize="xs" textTransform="uppercase">
            Health Summary
          </Text>
          <HStack gap={4} mt={3}>
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
            {topTwo.length === 0 ? (
              <Text color="fg.muted" fontSize="sm">
                Add providers to populate rankings.
              </Text>
            ) : (
              topTwo.map((p) => (
                <HStack justifyContent="space-between" key={p.id} mt={2}>
                  <RouterLink to={`/provider-governance/${p.id}`}>
                    <Text _hover={{ textDecoration: "underline" }} color="fg.info">
                      {p.display_name}
                    </Text>
                  </RouterLink>
                  <Badge borderRadius="full" colorPalette="green" px={3} py={1} variant="subtle">
                    —
                  </Badge>
                </HStack>
              ))
            )}
          </Box>
        </Box>
        <Box bg="bg.surface" borderRadius="xl" borderWidth={1} p={4}>
          <Text color="fg.muted" fontSize="xs" textTransform="uppercase">
            Most At-Risk Providers
          </Text>
          <Box mt={3}>
            {atRiskTwo.length === 0 ? (
              <Text color="fg.muted" fontSize="sm">
                Add at least two providers to show at-risk slice.
              </Text>
            ) : (
              atRiskTwo.map((p) => (
                <HStack justifyContent="space-between" key={p.id} mt={2}>
                  <RouterLink to={`/provider-governance/${p.id}`}>
                    <Text _hover={{ textDecoration: "underline" }} color="fg.info">
                      {p.display_name}
                    </Text>
                  </RouterLink>
                  <Badge borderRadius="full" colorPalette="yellow" px={3} py={1} variant="subtle">
                    —
                  </Badge>
                </HStack>
              ))
            )}
          </Box>
        </Box>
      </SimpleGrid>

      <Box bg="bg.surface" borderRadius="xl" borderWidth={1} mb={6} p={4}>
        <Flex alignItems="center" mb={4}>
          <Heading size="md">All Providers</Heading>
          <Spacer />
          <HStack gap={3}>
            <Input placeholder="Search providers or tags..." size="sm" width="260px" />
            <NativeSelect.Root size="sm" width="160px">
              <NativeSelect.Field>
                <option>Sort: Health Score</option>
              </NativeSelect.Field>
            </NativeSelect.Root>
          </HStack>
        </Flex>

        {providersList.length === 0 ? (
          <Text color="fg.muted" py={4}>
            No providers yet. Click &quot;Add provider&quot; to register one.
          </Text>
        ) : (
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
              {providersList.map((provider, index) => (
                <ProviderRow index={index} key={provider.id} provider={provider} />
              ))}
            </Table.Body>
          </Table.Root>
        )}
      </Box>

      <Box bg="bg.surface" borderRadius="xl" borderWidth={1} p={4}>
        <Flex alignItems="center" mb={4}>
          <Heading size="md">Provider Snapshot Comparison</Heading>
        </Flex>
        {providersList.length === 0 ? (
          <Text color="fg.muted" fontSize="sm">
            No snapshot data until providers are added.
          </Text>
        ) : (
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
              {providersList.map((p) => (
                <Table.Row key={p.id}>
                  <Table.Cell>{p.display_name}</Table.Cell>
                  <Table.Cell>—</Table.Cell>
                  <Table.Cell>—</Table.Cell>
                  <Table.Cell>—</Table.Cell>
                  <Table.Cell>—</Table.Cell>
                  <Table.Cell>—</Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
        )}
      </Box>
    </Box>
  );
};

export default ProviderGovernance;
