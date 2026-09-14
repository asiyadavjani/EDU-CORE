/*=========================================
        SHARED CHART HELPERS

        Imported by admin.js / teacher.js / student.js. Chart.js itself
        loads as a global `Chart` from the CDN <script> tag in each
        dashboard's HTML (added right before that dashboard's own
        type="module" script) — this file only holds what would otherwise
        be copy-pasted three times: one consistent color palette so every
        dashboard's charts look like part of the same product, and a
        couple of tiny helpers for patterns every chart needs.
=========================================*/

export const CHART_COLORS = {
    blue: "#0b6bd3",
    teal: "#0ea5a3",
    orange: "#f58220",
    green: "#22c55e",
    red: "#ef4444",
    purple: "#8b5cf6",
    grey: "#94a3b8"
};

export const CHART_PALETTE = [
    CHART_COLORS.blue, CHART_COLORS.orange, CHART_COLORS.teal,
    CHART_COLORS.purple, CHART_COLORS.green, CHART_COLORS.red
];

// Every dashboard tab that holds a chart gets re-rendered on every refresh
// (accept/reject a student, save attendance, switch a filter, ...) — and
// Chart.js throws "Canvas is already in use" if you `new Chart()` into a
// <canvas> that already has a live chart on it. Keeping instances here,
// keyed by canvas id, lets every render*Chart() function just call
// renderChart() and not worry about the previous draw.
const chartInstances = {};

export function renderChart(canvasId, config) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;
    if (chartInstances[canvasId]) chartInstances[canvasId].destroy();
    chartInstances[canvasId] = new Chart(canvas, config);
    return chartInstances[canvasId];
}

// A chart fed an empty dataset just renders a blank canvas — nothing tells
// the viewer whether that means "no data yet" or "still loading". This
// swaps in a single grey slice/bar with a label instead, so an empty
// course, an empty class, or a brand-new account all read as "empty" at a
// glance rather than "broken".
export function emptyChartConfig(type, label) {
    const isBarLike = type === "bar";
    return {
        type,
        data: {
            labels: [label],
            datasets: [{
                data: [1],
                backgroundColor: [CHART_COLORS.grey],
                borderColor: [CHART_COLORS.grey],
                borderWidth: 0
            }]
        },
        options: {
            plugins: { legend: { display: false }, tooltip: { enabled: false } },
            ...(isBarLike ? { scales: { y: { display: false }, x: { display: false } } } : {})
        }
    };
}
