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
import { Badge, Box, Flex, Heading, HStack, Input, Link, NativeSelect, SimpleGrid, Table, Text } from "@chakra-ui/react";
import { useEffect, useMemo, useState } from "react";
import { Link as RouterLink, useParams } from "react-router-dom";
import { toaster } from "src/components/ui";
import { getRedirectPath } from "src/utils/links";

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
    readonly health_score: number | null;
    readonly health_status: string | null;
    readonly issues_closed: number;
    readonly issues_open: number;
    readonly issues_total: number;
    readonly last_release: string | null;
    readonly pr_merge_rate: number;
    readonly prs_closed: number;
    readonly prs_open: number;
    readonly prs_total: number;
    /** Issues/PRs closed in the last 30 days (activity signal for health score). */
    readonly recent_closures_30d?: number;
  };
};

const formatHealthScore = (score: number | null): string => {
  if (score === null) {
    return "—";
  }
  return score.toFixed(1);
};

const getStatusBadgeProps = (status: string | null) => {
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

const getProviderInitials = (displayName: string): string =>
  displayName
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

const getProviderAvatarBg = (name: string): string => {
  const hue = (name.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) * 47) % 360;
  return `hsl(${hue}, 55%, 45%)`;
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

const calcDaysActive = (created: string, resolved: string | null, status: "OPEN" | "CLOSED"): number => {
  const createdDate = new Date(`${created}T00:00:00Z`);
  const endDate = status === "OPEN" ? new Date() : new Date(`${resolved}T00:00:00Z`);
  return Math.max(0, Math.round((endDate.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24)));
};

// ── Report generation ────────────────────────────────────────────────────────

// Mirrors the base weights from health_score.py
const _BASE_WEIGHTS: Record<string, number> = {
  activity: 0.3,
  issue_backlog: 0.18,
  pr_backlog: 0.15,
  pr_merge: 0.15,
  resolution: 0.22,
};

const _softBacklogScore = (openRatio: number): number => {
  const r = Math.min(1, Math.max(0, openRatio));
  return Math.max(12, Math.min(100, 100 * (1 - Math.pow(r, 1.35))));
};

type ComponentKey = "activity" | "issue_backlog" | "pr_backlog" | "pr_merge" | "resolution";
type ComponentScores = Partial<Record<ComponentKey, number>>;

const _computeComponentScores = (summary: ApiProviderDetail["summary"]): ComponentScores => {
  const scores: ComponentScores = {};

  if (summary.issues_total > 0) {
    scores.issue_backlog = _softBacklogScore(summary.issues_open / summary.issues_total);
  }

  if (summary.avg_resolution_hours != null) {
    scores.resolution = Math.max(0, Math.min(100, 100 * (1 - summary.avg_resolution_hours / 900)));
  }

  if (summary.prs_total > 0) {
    if (summary.prs_closed >= 1) {
      scores.pr_merge = summary.pr_merge_rate;
    }
    scores.pr_backlog = _softBacklogScore(summary.prs_open / summary.prs_total);
  }

  const activityParts: number[] = [];
  if (summary.contributors > 0) {
    activityParts.push(Math.min(100, (summary.contributors / 50) * 100));
  }
  if (summary.commits_30d > 0) {
    activityParts.push(Math.min(100, (summary.commits_30d / 20) * 100));
  }
  const closures = summary.recent_closures_30d ?? 0;
  if (closures > 0) {
    activityParts.push(Math.min(100, (closures / 15) * 100));
  }
  if (activityParts.length > 0) {
    scores.activity = Math.max(...activityParts);
  }

  return scores;
};

const _csvCell = (value: string | number | null | undefined): string => {
  const str = value == null ? "" : String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/gu, '""')}"`;
  }
  return str;
};

const _csvRow = (...cells: (string | number | null | undefined)[]): string =>
  cells.map(_csvCell).join(",");

const _COMPONENT_LABELS: Record<ComponentKey, string> = {
  activity: "Activity",
  issue_backlog: "Issue Backlog",
  pr_backlog: "PR Backlog",
  pr_merge: "PR Merge Rate",
  resolution: "Avg Resolution Time",
};

const buildCsvReport = (data: ApiProviderDetail): string => {
  const { issues, provider, prs, summary } = data;
  const lines: string[] = [];

  const blank = () => lines.push("");
  const section = (title: string) => lines.push(_csvRow(`=== ${title} ===`));

  const kv = (label: string, value: string | number | null | undefined) =>
    lines.push(_csvRow(label, value ?? "—"));

  const reportDate = new Date().toISOString().slice(0, 10);

  const allDates = [...issues, ...prs]
    .flatMap((r) => [r.created, r.resolved])
    .filter((d): d is string => d != null)
    .sort();
  const dataAsOf = allDates.at(-1) ?? "unknown";

  // ── 1: Provider Overview ──────────────────────────────────────────────────
  section("PROVIDER OVERVIEW");
  kv("Report Generated", reportDate);
  kv("Data As Of (latest record date)", dataAsOf);
  kv("Provider Name", provider.display_name);
  kv("Provider Key", provider.name);
  kv("GitHub Label", provider.tag);
  kv("Lifecycle Stage", provider.lifecycle);
  kv("Active", provider.is_active ? "Yes" : "No");
  kv("Steward Email", provider.steward_email);
  blank();

  // ── 2: Health Summary ─────────────────────────────────────────────────────
  section("HEALTH SUMMARY");
  kv("Health Score (0–100)", summary.health_score != null ? summary.health_score.toFixed(1) : "—");
  kv("Health Status", summary.health_status ?? "N/A");
  kv("Score Bands", ">=65 Healthy | 35–64 Warning | <35 Critical");
  if (!provider.is_active) {
    kv("Inactive Penalty", "Composite score reduced by 15% before final adjustment");
  }
  blank();

  // ── 3: Issue Metrics ──────────────────────────────────────────────────────
  section("ISSUE METRICS");
  kv("Total Issues", summary.issues_total);
  kv("Open Issues", summary.issues_open);
  kv("Closed Issues", summary.issues_closed);
  kv(
    "Open Ratio",
    summary.issues_total > 0
      ? `${((summary.issues_open / summary.issues_total) * 100).toFixed(1)}%`
      : "—",
  );
  kv(
    "Avg Resolution Time",
    summary.avg_resolution_hours != null
      ? `${Math.round(summary.avg_resolution_hours / 24)} days (${summary.avg_resolution_hours}h)`
      : "—",
  );
  blank();

  // ── 4: PR Metrics ─────────────────────────────────────────────────────────
  section("PR METRICS");
  kv("Total PRs", summary.prs_total);
  kv("Open PRs", summary.prs_open);
  kv("Merged / Closed PRs", summary.prs_closed);
  kv("PR Merge Rate", `${summary.pr_merge_rate}%`);
  blank();

  // ── 5: Activity Signals ───────────────────────────────────────────────────
  section("ACTIVITY SIGNALS");
  kv("Contributor Signals (not unique individuals — see Limitations)", summary.contributors);
  kv("Total PR Commits (all tracked PRs — see Limitations)", summary.commits_30d);
  kv("Issues + PRs Closed (last 30 days)", summary.recent_closures_30d ?? "—");
  blank();

  // ── 6: Score Breakdown ────────────────────────────────────────────────────
  section("HEALTH SCORE BREAKDOWN");
  const componentScores = _computeComponentScores(summary);
  const presentKeys = (Object.keys(componentScores) as ComponentKey[]).sort();
  const weightSum = presentKeys.reduce((acc, k) => acc + (_BASE_WEIGHTS[k] ?? 0), 0);

  lines.push(_csvRow("Component", "Score (/100)", "Effective Weight (%)", "Contribution"));

  type ComponentRow = { contribution: number; effectiveWeight: number; key: ComponentKey; score: number };
  const componentRows: ComponentRow[] = [];
  let totalContribution = 0;

  for (const k of presentKeys) {
    const score = componentScores[k] ?? 0;
    const baseWeight = _BASE_WEIGHTS[k] ?? 0;
    const effectiveWeight = (baseWeight / weightSum) * 100;
    const contribution = score * (baseWeight / weightSum);
    totalContribution += contribution;
    componentRows.push({ contribution, effectiveWeight, key: k, score });
    lines.push(_csvRow(_COMPONENT_LABELS[k], score.toFixed(1), `${effectiveWeight.toFixed(1)}%`, contribution.toFixed(1)));
  }
  lines.push(_csvRow("COMPOSITE (before adjustments)", "", "", totalContribution.toFixed(1)));
  blank();

  // ── 7: Improvement Recommendations ───────────────────────────────────────
  section("IMPROVEMENT RECOMMENDATIONS");
  lines.push(_csvRow("Priority", "Component", "Current Score (/100)", "Effective Weight (%)", "Recommendation"));

  const SCORE_THRESHOLD = 65;
  const closures = summary.recent_closures_30d ?? 0;
  const recMap: Record<ComponentKey, string> = {
    activity: `Activity score is driven by the highest signal: contributor signals (${summary.contributors}/50 cap), PR commits (${summary.commits_30d}/20 cap), items closed last 30d (${closures}/15 cap). Focus on whichever signal is closest to its cap.`,
    issue_backlog: `${summary.issues_open} of ${summary.issues_total} issues are open (${((summary.issues_open / Math.max(summary.issues_total, 1)) * 100).toFixed(0)}%). Triage and close stale issues to reduce the open ratio.`,
    pr_backlog: `${summary.prs_open} of ${summary.prs_total} PRs are open. Increase review cadence to merge or close stale PRs.`,
    pr_merge: `${summary.prs_closed} PRs merged out of ${summary.prs_total} total (${summary.pr_merge_rate}% merge rate). Aim to merge or close the ${summary.prs_open} open PRs.`,
    resolution: summary.avg_resolution_hours != null
      ? `Avg resolution is ${Math.round(summary.avg_resolution_hours / 24)} days. Target under 12 days for a score above 75. Prioritise long-running open issues.`
      : "No resolution data available yet — close some issues to generate this signal.",
  };

  const sorted = [...componentRows].sort(
    (a, b) => (100 - b.score) * b.effectiveWeight - (100 - a.score) * a.effectiveWeight,
  );

  let priority = 1;
  for (const row of sorted) {
    if (row.score < SCORE_THRESHOLD) {
      lines.push(_csvRow(priority, _COMPONENT_LABELS[row.key], row.score.toFixed(1), `${row.effectiveWeight.toFixed(1)}%`, recMap[row.key]));
      priority++;
    }
  }
  if (priority === 1) {
    lines.push(_csvRow("", "All components score above the healthy threshold (>=65). No critical actions needed."));
  }
  blank();

  // ── 8: Stalled Items (open > 60 days) ────────────────────────────────────
  const STALL_DAYS = 60;
  const stalledIssues = issues.filter(
    (i) => i.status === "OPEN" && calcDaysActive(i.created, i.resolved, "OPEN") > STALL_DAYS,
  );
  const stalledPRs = prs.filter(
    (p) => p.status === "OPEN" && calcDaysActive(p.created, p.resolved, "OPEN") > STALL_DAYS,
  );

  if (stalledIssues.length > 0 || stalledPRs.length > 0) {
    section(`STALLED ITEMS (open > ${STALL_DAYS} days)`);
    lines.push(_csvRow("Type", "#", "Title", "URL", "Days Open"));
    for (const issue of stalledIssues) {
      lines.push(_csvRow("Issue", issue.number != null ? `#${issue.number}` : "—", issue.title, issue.url, calcDaysActive(issue.created, issue.resolved, "OPEN")));
    }
    for (const pr of stalledPRs) {
      lines.push(_csvRow("PR", pr.number != null ? `#${pr.number}` : "—", pr.title, pr.url, calcDaysActive(pr.created, pr.resolved, "OPEN")));
    }
    blank();
  }

  // ── 9: Issues Detail ─────────────────────────────────────────────────────
  section("ISSUES DETAIL");
  lines.push(_csvRow("#", "Title", "URL", "Created", "Resolved", "Status", "Days Active"));
  for (const issue of issues) {
    lines.push(_csvRow(
      issue.number != null ? `#${issue.number}` : "—",
      issue.title,
      issue.url,
      issue.created,
      issue.resolved ?? "—",
      issue.status,
      calcDaysActive(issue.created, issue.resolved, issue.status),
    ));
  }
  blank();

  // ── 10: Pull Requests Detail ──────────────────────────────────────────────
  section("PULL REQUESTS DETAIL");
  lines.push(_csvRow("#", "Title", "URL", "Opened", "Closed", "Status", "Days Active"));
  for (const pr of prs) {
    lines.push(_csvRow(
      pr.number != null ? `#${pr.number}` : "—",
      pr.title,
      pr.url,
      pr.created,
      pr.resolved ?? "—",
      pr.status,
      calcDaysActive(pr.created, pr.resolved, pr.status),
    ));
  }
  blank();

  // ── 11: Limitations ──────────────────────────────────────────────────────
  section("LIMITATIONS & NOTES");
  lines.push(_csvRow("Note", "Contributor Signals is not a unique headcount — it sums assignee/author/reviewer signals per row and may count the same person multiple times."));
  lines.push(_csvRow("Note", "Total PR Commits covers all tracked PRs regardless of date (the 'commits_30d' field name is a legacy label)."));
  lines.push(_csvRow("Note", "Issues + PRs Closed (last 30 days) combines both item types into a single activity signal."));
  lines.push(_csvRow("Note", "Last Release data is not currently available from the backend."));
  lines.push(_csvRow("Note", "This report is a point-in-time snapshot. No historical trend data is available."));

  // Prepend UTF-8 BOM so Excel and Windows tools open the file with correct
  // UTF-8 encoding rather than defaulting to Windows-1252.
  return "\uFEFF" + lines.join("\n");
};

const ProviderGovernanceDetail = () => {
  const { providerId } = useParams();
  const [data, setData] = useState<ApiProviderDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [issueSearch, setIssueSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "OPEN" | "CLOSED">("ALL");

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

  const healthScore = summary?.health_score ?? null;
  const apiStatus = summary?.health_status ?? null;
  const statusBadge = getStatusBadgeProps(apiStatus);

  const issues = data?.issues ?? [];
  const prs = data?.prs ?? [];

  const filteredIssues = useMemo(() => {
    const q = issueSearch.trim().toLowerCase();
    return issues.filter((issue) => {
      const matchesSearch = q ? issue.title.toLowerCase().includes(q) : true;
      const matchesStatus = statusFilter === "ALL" ? true : issue.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [issues, issueSearch, statusFilter]);

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

  const handleDownloadReport = () => {
    if (!data) return;
    const csv = buildCsvReport(data);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${data.provider.name}-governance-report-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

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
            bg={getProviderAvatarBg(provider?.name ?? "")}
            borderRadius="full"
            boxSize={12}
            color="white"
            display="flex"
            fontSize="sm"
            fontWeight="bold"
            justifyContent="center"
          >
            {getProviderInitials(provider?.display_name ?? "?")}
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
          <Link
            borderRadius="lg"
            borderWidth={1}
            color="fg.muted"
            fontSize="sm"
            href={provider?.steward_email ? `mailto:${provider.steward_email}` : undefined}
            px={4}
            py={2}
            textDecoration="none"
            _hover={{ bg: "bg.muted", textDecoration: "none" }}
          >
            Email Steward
          </Link>
          <Box
            as="button"
            bg={isLoading || !data ? "blue.300" : "blue.500"}
            borderRadius="lg"
            color="white"
            cursor={isLoading || !data ? "not-allowed" : "pointer"}
            fontSize="sm"
            onClick={handleDownloadReport}
            px={4}
            py={2}
            _hover={{ bg: isLoading || !data ? "blue.300" : "blue.600" }}
          >
            Download Report
          </Box>
        </HStack>
      </Flex>

      <SimpleGrid columns={{ base: 2, md: 4 }} gap={4} mb={6}>
        <StatCard
          label="Health Score"
          sublabel={isLoading ? undefined : statusBadge.label}
          value={isLoading ? "—" : formatHealthScore(healthScore)}
        />
        <StatCard
          label="Total Issues"
          sublabel={isLoading ? undefined : `${totalIssuesOpen} open \u00b7 ${totalIssuesClosed} closed`}
          value={isLoading ? "—" : totalIssuesTotal}
        />
        <StatCard label="Avg Resolution (days)" value={isLoading ? "—" : `${avgResolutionDays}d`} />
        <StatCard
          label="PR Volume"
          sublabel={isLoading ? undefined : `${prVolumeMerged} merged \u00b7 ${prVolumeOpen} open`}
          value={isLoading ? "—" : prVolumeMerged + prVolumeOpen}
        />
      </SimpleGrid>

      <Box bg="bg.surface" borderRadius="xl" borderWidth={1} mb={6} p={4}>
        <Text color="fg.muted" fontSize="xs" mb={4} textTransform="uppercase">
          Issue &amp; PR Volume
        </Text>
        <Flex alignItems="flex-end" gap={8} justifyContent="center" minH="220px">
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

      {/* Issues table */}
      <Box bg="bg.surface" borderRadius="xl" borderWidth={1} mb={6} p={4}>
        <Flex alignItems="center" justifyContent="space-between" mb={4}>
          <Heading size="md">Issues ({filteredIssues.length})</Heading>
          <HStack gap={3}>
            <Input
              onChange={(e) => setIssueSearch(e.target.value)}
              placeholder="Search issues..."
              size="sm"
              value={issueSearch}
              width="260px"
            />
            <NativeSelect.Root size="sm" width="140px">
              <NativeSelect.Field
                onChange={(e) => setStatusFilter(e.target.value as "ALL" | "OPEN" | "CLOSED")}
                value={statusFilter}
              >
                <option value="ALL">All Status</option>
                <option value="OPEN">Open</option>
                <option value="CLOSED">Closed</option>
              </NativeSelect.Field>
            </NativeSelect.Root>
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
                  <Text color="fg.muted">No issues synced yet. Click "Refresh metrics" on the overview page.</Text>
                </Table.Cell>
              </Table.Row>
            ) : filteredIssues.length === 0 ? (
              <Table.Row>
                <Table.Cell colSpan={6}>
                  <Text color="fg.muted">No issues match the current filter.</Text>
                </Table.Cell>
              </Table.Row>
            ) : (
              filteredIssues.slice(0, 200).map((issue) => {
                const badge =
                  issue.status === "OPEN"
                    ? { colorPalette: "orange", label: "Open" }
                    : { colorPalette: "green", label: "Closed" };
                const daysActive = calcDaysActive(issue.created, issue.resolved, issue.status);
                const displayNum = issue.number ? `#${issue.number}` : "—";
                return (
                  <Table.Row key={issue.url}>
                    <Table.Cell>
                      <Link color="fg.info" href={issue.url} target="_blank">
                        {displayNum}
                      </Link>
                    </Table.Cell>
                    <Table.Cell>{issue.title}</Table.Cell>
                    <Table.Cell>{issue.created}</Table.Cell>
                    <Table.Cell>{issue.resolved ?? "—"}</Table.Cell>
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

      {/* Pull Requests table */}
      <Box bg="bg.surface" borderRadius="xl" borderWidth={1} p={4}>
        <Flex alignItems="center" mb={4}>
          <Heading size="md">Pull Requests ({prs.length})</Heading>
        </Flex>
        <Table.Root size="sm">
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeader>PR</Table.ColumnHeader>
              <Table.ColumnHeader>Title</Table.ColumnHeader>
              <Table.ColumnHeader>Opened</Table.ColumnHeader>
              <Table.ColumnHeader>Closed</Table.ColumnHeader>
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
            ) : prs.length === 0 ? (
              <Table.Row>
                <Table.Cell colSpan={6}>
                  <Text color="fg.muted">No PRs synced yet. Click "Refresh metrics" on the overview page.</Text>
                </Table.Cell>
              </Table.Row>
            ) : (
              prs.slice(0, 200).map((pr) => {
                const badge =
                  pr.status === "OPEN"
                    ? { colorPalette: "orange", label: "Open" }
                    : { colorPalette: "purple", label: "Merged" };
                const daysActive = calcDaysActive(pr.created, pr.resolved, pr.status);
                const displayNum = pr.number ? `#${pr.number}` : "—";
                return (
                  <Table.Row key={pr.url}>
                    <Table.Cell>
                      <Link color="fg.info" href={pr.url} target="_blank">
                        {displayNum}
                      </Link>
                    </Table.Cell>
                    <Table.Cell>{pr.title}</Table.Cell>
                    <Table.Cell>{pr.created}</Table.Cell>
                    <Table.Cell>{pr.resolved ?? "—"}</Table.Cell>
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
