{{/* vim: set filetype=mustache: */}}

{{/*
Expand the name of the chart.
*/}}
{{- define "ingress-controller.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "ingress-controller.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "ingress-controller.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "ingress-controller.labels" -}}
helm.sh/chart: {{ include "ingress-controller.chart" . }}
{{ include "ingress-controller.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "ingress-controller.selectorLabels" -}}
app.kubernetes.io/name: {{ include "ingress-controller.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Backend ingress specific labels
*/}}
{{- define "backend.ingress.labels" -}}
helm.sh/chart: {{ include "ingress-controller.chart" . }}
app.kubernetes.io/name: {{ .Values.backend.name }}-ingress
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/component: ingress
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Frontend ingress specific labels
*/}}
{{- define "frontend.ingress.labels" -}}
helm.sh/chart: {{ include "ingress-controller.chart" . }}
app.kubernetes.io/name: {{ .Values.frontend.name }}-ingress
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/component: ingress
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}
