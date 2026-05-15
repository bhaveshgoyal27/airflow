# Airflow Provider Governance Dashboard

This repository is an Apache Airflow fork containing the Provider Governance Dashboard project. The feature adds a PMC-focused dashboard for tracking provider health using GitHub issue and PR metrics, health scoring, and overview/detail UI pages inside Airflow.

The complete project handoff, setup notes, architecture details, implementation summary, and testing information live in [`provider-governance-handoff/`](provider-governance-handoff/).

## Start Here

- [`Provider Governance Maintainer Manual`](provider-governance-handoff/PROVIDER_GOVERNANCE_MAINTAINER_MANUAL.md): main handoff entry point for scope, design summary, workflows, testing, and deployment pointers.

## Handoff Documents

- [`System Architecture`](provider-governance-handoff/system-architecture.md): design narrative, component overview, and API/database context.
- [`Summary of Changes`](provider-governance-handoff/PROVIDER_GOVERNANCE_CHANGES.md): implemented routes, migrations, UI behavior, metric formulas, and code locations.
- [`Testing Plan`](provider-governance-handoff/PROVIDER_GOVERNANCE_TESTING_PLAN.md): automated tests, manual integration checks, coverage notes, and user acceptance testing.
- [`Dev Environment Setup`](provider-governance-handoff/AIRFLOW-DEV-SETUP.md): local setup, install steps, UI build notes, and run commands.
- [`Deployment diagram`](diagrams/deployment_diagram.png) and [`Component integration diagram`](diagrams/component_diagram.png): static UML-style views (also embedded in [Maintainer Manual §3](provider-governance-handoff/PROVIDER_GOVERNANCE_MAINTAINER_MANUAL.md)).

## Original Airflow Project

<img src="https://github.com/apache/airflow/blob/main/airflow-core/docs/img/logos/wordmark_1.png?raw=true" alt="Apache Airflow logo" width="260">

This work is built on Apache Airflow. For upstream documentation and general Airflow usage, see the [Apache Airflow documentation](https://airflow.apache.org/docs/) and the [Apache Airflow GitHub repository](https://github.com/apache/airflow).
