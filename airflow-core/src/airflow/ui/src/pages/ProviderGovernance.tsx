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
import { useCallback, useEffect, useMemo, useState } from "react";
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

type ApiProviderSummaryRow = {
  readonly avg_resolution_hours: number | null;
  readonly commits_30d: number;
  readonly contributors: number;
  readonly health_score: number | null;
  readonly health_status: string | null;
  readonly issues_closed: number;
  readonly issues_open: number;
  readonly issues_total: number;
  readonly pr_merge_rate: number;
  readonly prs_closed: number;
  readonly prs_open: number;
  readonly prs_total: number;
  readonly provider_id: number;
};

type ProviderGovernanceMetrics = {
  readonly avgResolutionHours: number | null;
  readonly commits30d: number;
  readonly contributors: number;
  readonly healthScore: number | null;
  readonly healthStatus: string | null;
  readonly openIssues: number;
  readonly prMergeRate: number;
  readonly prVolume: number;
};

type ProviderWithMetrics = ApiProvider & {
  readonly metrics: ProviderGovernanceMetrics;
};

const formatHealthScore = (score: number | null): string => {
  if (score === null) {
    return "—";
  }
  return score.toFixed(1);
};

const getHealthBadgeProps = (
  status: string | null,
): {
  readonly colorPalette: string;
  readonly label: string;
} => {
  switch (status) {
    case "healthy":
      return { colorPalette: "green", label: "Healthy" };
    case "warning":
      return { colorPalette: "yellow", label: "Warning" };
    case "critical":
      return { colorPalette: "red", label: "Critical" };
    default:
      return { colorPalette: "gray", label: "N/A" };
  }
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
  isSelected,
  provider,
  metrics,
  onToggle,
}: {
  readonly index: number;
  readonly isSelected: boolean;
  readonly provider: ApiProvider;
  readonly metrics: ProviderGovernanceMetrics;
  readonly onToggle: (providerId: number) => void;
}) => (
  <Table.Row>
    <Table.Cell>
      <Checkbox checked={isSelected} onChange={() => onToggle(provider.id)} size="sm" />
    </Table.Cell>
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
      {(() => {
        const { colorPalette, label } = getHealthBadgeProps(metrics.healthStatus);
        return (
          <Badge borderRadius="full" colorPalette={colorPalette} px={3} py={1} variant="subtle">
            {label}
          </Badge>
        );
      })()}
    </Table.Cell>
    <Table.Cell>{metrics.openIssues}</Table.Cell>
    <Table.Cell>{metrics.prVolume}</Table.Cell>
  </Table.Row>
);

const ProviderGovernance = () => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [providersList, setProvidersList] = useState<Array<ApiProvider>>([]);
  const [providerSummaries, setProviderSummaries] = useState<Record<number, ApiProviderSummaryRow>>({});
  const [addOpen, setAddOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formName, setFormName] = useState("");
  const [formDisplayName, setFormDisplayName] = useState("");
  const [formLifecycle, setFormLifecycle] = useState("production");
  const [formActive, setFormActive] = useState(true);
  const [formStewardEmail, setFormStewardEmail] = useState("bg487@cornell.edu");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"health_score" | "open_issues" | "name">("health_score");
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [selectedProviderIds, setSelectedProviderIds] = useState<Array<number>>([]);
  const [isDeletingProviders, setIsDeletingProviders] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const loadProviders = useCallback(async () => {
    const origin = window.location.origin;
    const res = await fetch(`${origin}${getRedirectPath("ui/provider-governance/providers")}`);
    if (!res.ok) {
      throw new Error("Failed to load providers");
    }
    const data = (await res.json()) as Array<ApiProvider>;
    setProvidersList(data);
  }, []);

  const loadProviderSummaries = useCallback(async () => {
    const origin = window.location.origin;
    const res = await fetch(`${origin}${getRedirectPath("ui/provider-governance/providers/summary")}`);
    if (!res.ok) {
      throw new Error("Failed to load provider summary");
    }
    const rows = (await res.json()) as Array<ApiProviderSummaryRow>;
    const map: Record<number, ApiProviderSummaryRow> = {};
    for (const row of rows) {
      map[row.provider_id] = row;
    }
    setProviderSummaries(map);
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        await loadProviders();
        await loadProviderSummaries();
        setLastRefreshed(new Date());
      } catch {
        toaster.create({
          title: "Could not load providers",
          description: "Check that the API is available.",
          type: "error",
        });
      }
    })();
  }, [loadProviderSummaries, loadProviders]);

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
      await loadProviderSummaries();
      setLastRefreshed(new Date());
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
  }, [loadProviderSummaries, loadProviders]);

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
      await loadProviderSummaries();
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

  const handleToggleProviderSelection = useCallback((providerId: number) => {
    setSelectedProviderIds((prev) =>
      prev.includes(providerId) ? prev.filter((id) => id !== providerId) : [...prev, providerId],
    );
  }, []);

  const providersWithMetrics = useMemo<Array<ProviderWithMetrics>>(() => {
    return providersList.map((p) => {
      const summaryRow = providerSummaries[p.id];
      return {
        ...p,
        metrics: {
          avgResolutionHours: summaryRow?.avg_resolution_hours ?? null,
          commits30d: summaryRow?.commits_30d ?? 0,
          contributors: summaryRow?.contributors ?? 0,
          healthScore: summaryRow?.health_score ?? null,
          healthStatus: summaryRow?.health_status ?? null,
          openIssues: summaryRow?.issues_open ?? 0,
          prMergeRate: summaryRow?.pr_merge_rate ?? 0,
          prVolume: summaryRow?.prs_total ?? 0,
        },
      };
    });
  }, [providerSummaries, providersList]);

  const summary = useMemo(() => {
    if (providersWithMetrics.length === 0) {
      return {
        critical: 0,
        healthy: 0,
        avgResolutionHours: null as number | null,
        totalIssues: 0,
        warning: 0,
      };
    }

    const totalIssues = providersWithMetrics.reduce((acc, p) => acc + p.metrics.openIssues, 0);
    const avgResolutionHoursValues = providersWithMetrics
      .map((p) => p.metrics.avgResolutionHours)
      .filter((v): v is number => v !== null);
    const avgResolutionHours =
      avgResolutionHoursValues.length > 0
        ? Math.round(
            avgResolutionHoursValues.reduce((acc, v) => acc + v, 0) /
              avgResolutionHoursValues.length,
          )
        : null;

    const healthy = providersWithMetrics.filter((p) => p.metrics.healthStatus === "healthy").length;
    const warning = providersWithMetrics.filter((p) => p.metrics.healthStatus === "warning").length;
    const critical = providersWithMetrics.filter((p) => p.metrics.healthStatus === "critical").length;

    return { critical, healthy, avgResolutionHours, totalIssues, warning };
  }, [providersWithMetrics]);

  const sortedProviders = useMemo(() => {
    return [...providersWithMetrics].sort((a, b) => {
      const as = a.metrics.healthScore;
      const bs = b.metrics.healthScore;
      if (as === null && bs === null) {
        return 0;
      }
      if (as === null) {
        return 1;
      }
      if (bs === null) {
        return -1;
      }
      return bs - as;
    });
  }, [providersWithMetrics]);

  const displayedProviders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = q
      ? providersWithMetrics.filter(
          (p) =>
            p.display_name.toLowerCase().includes(q) ||
            p.name.toLowerCase().includes(q) ||
            p.lifecycle.toLowerCase().includes(q),
        )
      : providersWithMetrics;

    return [...filtered].sort((a, b) => {
      if (sortBy === "open_issues") return b.metrics.openIssues - a.metrics.openIssues;
      if (sortBy === "name") return a.display_name.localeCompare(b.display_name);
      const as = a.metrics.healthScore;
      const bs = b.metrics.healthScore;
      if (as === null && bs === null) {
        return 0;
      }
      if (as === null) {
        return 1;
      }
      if (bs === null) {
        return -1;
      }
      return bs - as;
    });
  }, [providersWithMetrics, searchQuery, sortBy]);

  const selectedVisibleProviderCount = useMemo(
    () => displayedProviders.filter((provider) => selectedProviderIds.includes(provider.id)).length,
    [displayedProviders, selectedProviderIds],
  );
  const allVisibleProvidersSelected =
    displayedProviders.length > 0 && selectedVisibleProviderCount === displayedProviders.length;

  const handleToggleSelectAllVisible = useCallback(() => {
    if (allVisibleProvidersSelected) {
      setSelectedProviderIds((prev) =>
        prev.filter((id) => !displayedProviders.some((provider) => provider.id === id)),
      );
      return;
    }
    setSelectedProviderIds((prev) => {
      const selected = new Set(prev);
      displayedProviders.forEach((provider) => selected.add(provider.id));
      return Array.from(selected);
    });
  }, [allVisibleProvidersSelected, displayedProviders]);

  const handleDeleteProviders = useCallback(async () => {
    if (selectedProviderIds.length === 0) {
      toaster.create({
        title: "No providers selected",
        description: "Select at least one provider to delete.",
        type: "error",
      });
      return;
    }
    setIsDeletingProviders(true);
    const origin = window.location.origin;
    try {
      await Promise.all(
        selectedProviderIds.map(async (providerId) => {
          const res = await fetch(
            `${origin}${getRedirectPath(`ui/provider-governance/providers/${providerId}`)}`,
            { method: "DELETE" },
          );
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(
              (err as { detail?: string })?.detail ?? `Failed to delete provider with id=${providerId}`,
            );
          }
        }),
      );
      toaster.create({
        title: "Providers deleted",
        description: `Deleted ${selectedProviderIds.length} provider(s).`,
        type: "success",
      });
      setSelectedProviderIds([]);
      await loadProviders();
      await loadProviderSummaries();
    } catch (err) {
      toaster.create({
        title: "Could not delete providers",
        description: err instanceof Error ? err.message : "Unknown error",
        type: "error",
      });
    } finally {
      setIsDeletingProviders(false);
    }
  }, [loadProviderSummaries, loadProviders, selectedProviderIds]);

  const openDeleteDialog = useCallback(() => {
    if (selectedProviderIds.length === 0) {
      toaster.create({
        title: "No providers selected",
        description: "Select at least one provider to delete.",
        type: "error",
      });
      return;
    }
    setDeleteOpen(true);
  }, [selectedProviderIds.length]);

  const totalProviders = providersList.length;
  const topTwo = sortedProviders.slice(0, 2);
  const atRiskTwo = sortedProviders.length >= 2 ? sortedProviders.slice(-2) : [];

  return (
    <Box overflow="auto" px={{ base: 2, md: 4 }} py={4}>
      <Flex alignItems="baseline" justifyContent="space-between" mb={4}>
        <Box>
          <Heading size="lg">Provider Health Overview</Heading>
          <Text color="fg.muted" fontSize="sm" mt={1}>
            Governance dashboard for Apache Airflow providers
          </Text>
          {lastRefreshed !== null && (
            <Text color="fg.muted" fontSize="xs" mt={1}>
              Last updated {lastRefreshed.toLocaleString()}
            </Text>
          )}
        </Box>
        <HStack gap={3} flexWrap="wrap" justifyContent="flex-end">
          <Button onClick={() => setAddOpen(true)} size="sm" variant="solid">
            Add provider
          </Button>
          <Button
            colorPalette="red"
            disabled={selectedProviderIds.length === 0}
            loading={isDeletingProviders}
            onClick={openDeleteDialog}
            size="sm"
            variant="outline"
          >
            Delete providers
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

      <Dialog.Root onOpenChange={(d) => setDeleteOpen(d.open)} open={deleteOpen} size="md">
        <Dialog.Content backdrop>
          <Dialog.Header>
            <Heading size="md">Delete providers</Heading>
          </Dialog.Header>
          <Dialog.CloseTrigger />
          <Dialog.Body>
            <Text>
              Delete {selectedProviderIds.length} provider{selectedProviderIds.length === 1 ? "" : "s"}?
            </Text>
          </Dialog.Body>
          <Dialog.Footer>
            <HStack gap={3}>
              <Button onClick={() => setDeleteOpen(false)} variant="outline">
                Cancel
              </Button>
              <Button
                colorPalette="red"
                loading={isDeletingProviders}
                onClick={async () => {
                  await handleDeleteProviders();
                  setDeleteOpen(false);
                }}
              >
                Delete
              </Button>
            </HStack>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Root>

      <SimpleGrid columns={{ base: 1, md: 3 }} gap={4} mb={6}>
        <StatCard label="Total Providers (in this cycle)" value={totalProviders} />
        <StatCard label="Total Issues" value={summary.totalIssues} />
        <StatCard
          label="Avg Resolution (days)"
          value={summary.avgResolutionHours === null ? "—" : `${Math.round(summary.avgResolutionHours / 24)}d`}
        />
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
                  {(() => {
                    const { colorPalette } = getHealthBadgeProps(p.metrics.healthStatus);
                    return (
                      <Badge borderRadius="full" colorPalette={colorPalette} px={3} py={1} variant="subtle">
                        {formatHealthScore(p.metrics.healthScore)}
                      </Badge>
                    );
                  })()}
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
                  {(() => {
                    const { colorPalette } = getHealthBadgeProps(p.metrics.healthStatus);
                    return (
                      <Badge borderRadius="full" colorPalette={colorPalette} px={3} py={1} variant="subtle">
                        {formatHealthScore(p.metrics.healthScore)}
                      </Badge>
                    );
                  })()}
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
            <Input
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name or lifecycle..."
              size="sm"
              value={searchQuery}
              width="260px"
            />
            <NativeSelect.Root size="sm" width="180px">
              <NativeSelect.Field
                onChange={(e) => setSortBy(e.target.value as "health_score" | "open_issues" | "name")}
                value={sortBy}
              >
                <option value="health_score">Sort: Health Score</option>
                <option value="open_issues">Sort: Open Issues</option>
                <option value="name">Sort: Name (A–Z)</option>
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
                <Table.ColumnHeader>
                  <Checkbox
                    checked={allVisibleProvidersSelected}
                    onChange={handleToggleSelectAllVisible}
                    size="sm"
                  />
                </Table.ColumnHeader>
                <Table.ColumnHeader>#</Table.ColumnHeader>
                <Table.ColumnHeader>Provider</Table.ColumnHeader>
                <Table.ColumnHeader>Health</Table.ColumnHeader>
                <Table.ColumnHeader>Open Issues</Table.ColumnHeader>
                <Table.ColumnHeader>PR Volume</Table.ColumnHeader>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {displayedProviders.map((provider, index) => (
                <ProviderRow
                  index={index}
                  isSelected={selectedProviderIds.includes(provider.id)}
                  key={provider.id}
                  metrics={provider.metrics}
                  onToggle={handleToggleProviderSelection}
                  provider={provider}
                />
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
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {providersWithMetrics.map((p) => (
                <Table.Row key={p.id}>
                  <Table.Cell>{p.display_name}</Table.Cell>
                  <Table.Cell>{formatHealthScore(p.metrics.healthScore)}</Table.Cell>
                  <Table.Cell>{p.metrics.openIssues}</Table.Cell>
                  <Table.Cell>{p.metrics.prMergeRate}%</Table.Cell>
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
