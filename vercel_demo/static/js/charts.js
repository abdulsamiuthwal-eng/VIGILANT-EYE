/**
 * Vigilant Eye — Charts & Statistics JS
 * Chart.js powered analytics dashboard
 */

const Charts = (() => {
  let weeklyChart = null;
  let activityChart = null;
  let hourlyChart = null;

  const chartDefaults = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: "rgba(255,255,255,0.6)", font: { family: "Outfit", size: 12 } } },
      tooltip: {
        backgroundColor: "rgba(5,13,31,0.95)",
        borderColor: "rgba(0,120,255,0.3)",
        borderWidth: 1,
        titleFont: { family: "Outfit", weight: "bold" },
        bodyFont: { family: "Outfit" },
        titleColor: "#fff",
        bodyColor: "rgba(255,255,255,0.7)",
      }
    },
    scales: {
      x: { grid: { color: "rgba(255,255,255,0.04)" }, ticks: { color: "rgba(255,255,255,0.45)", font: { family: "Outfit" } } },
      y: { grid: { color: "rgba(255,255,255,0.04)" }, ticks: { color: "rgba(255,255,255,0.45)", font: { family: "Outfit" } }, beginAtZero: true }
    }
  };

  function initWeeklyChart(labels, data) {
    const ctx = document.getElementById("weeklyChart");
    if (!ctx) return;
    if (weeklyChart) weeklyChart.destroy();
    
    const chartCtx = ctx.getContext("2d");
    const gradient = chartCtx.createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, "rgba(0,180,255,0.8)");
    gradient.addColorStop(1, "rgba(0,120,255,0.1)");
    
    weeklyChart = new Chart(ctx, {
      type: "bar",
      data: {
        labels: labels,
        datasets: [{
          label: "Weekly Detections",
          data: data,
          backgroundColor: gradient,
          borderColor: "rgba(0,180,255,1)",
          borderWidth: 2,
          borderRadius: 8,
          borderSkipped: false,
        }]
      },
      options: { 
        ...chartDefaults, 
        plugins: { 
          ...chartDefaults.plugins, 
          legend: { display: true, position: 'top', labels: { color: "rgba(255,255,255,0.85)", font: { family: "Outfit", size: 12 }, usePointStyle: true } } 
        },
        scales: {
          ...chartDefaults.scales,
          y: { ...chartDefaults.scales.y, beginAtZero: true, suggestedMax: Math.max(...(data.length ? data : [0]), 10) }
        }
      }
    });
  }

  function initActivityChart(labels, data) {
    const ctx = document.getElementById("activityChart");
    if (!ctx) return;
    if (activityChart) activityChart.destroy();
    activityChart = new Chart(ctx, {
      type: "pie",
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: [
            "rgba(255, 69, 58, 0.9)",
            "rgba(255, 159, 10, 0.9)",
            "rgba(255, 214, 10, 0.9)",
            "rgba(48, 209, 88, 0.9)",
            "rgba(10, 132, 255, 0.9)",
          ],
          borderColor: "rgba(10,15,35,1)",
          borderWidth: 2,
          hoverOffset: 8,
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: "right", labels: { color: "rgba(255,255,255,0.85)", font: { family: "Outfit", size: 12 }, padding: 15, usePointStyle: true, pointStyle: 'circle' } },
          tooltip: chartDefaults.plugins.tooltip,
        },
      }
    });
  }

  function initHourlyChart() {
    const ctx = document.getElementById("hourlyChart");
    if (!ctx) return;
    if (hourlyChart) hourlyChart.destroy();
    // Generate simulated hourly data
    const hours = Array.from({length: 24}, (_, i) => `${i.toString().padStart(2,"0")}:00`);
    const data = Array.from({length: 24}, (_, i) => {
      if (i >= 9 && i <= 18) return Math.floor(Math.random() * 8);
      if (i >= 19 && i <= 22) return Math.floor(Math.random() * 4);
      return Math.floor(Math.random() * 2);
    });

    hourlyChart = new Chart(ctx, {
      type: "line",
      data: {
        labels: hours,
        datasets: [{
          label: "Alerts per Hour",
          data: data,
          fill: true,
          borderColor: "rgba(0,200,255,0.8)",
          backgroundColor: "rgba(0,120,255,0.08)",
          pointBackgroundColor: "rgba(0,200,255,0.9)",
          pointRadius: 3,
          pointHoverRadius: 5,
          tension: 0.4,
          borderWidth: 2,
        }]
      },
      options: { ...chartDefaults, plugins: { ...chartDefaults.plugins, legend: { display: false } } }
    });
  }

  function getMockWeeklyData(events) {
    const days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
    const result = [];
    
    // Default mock data if events list is empty
    const mockCounts = [12, 19, 8, 15, 22, 14, 9];
    
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayName = days[d.getDay()];
      const dayDate = d.toDateString();
      
      const count = events.filter(e => {
        const timestampMs = e.timestamp ? (e.timestamp * 1000) : Date.now();
        return new Date(timestampMs).toDateString() === dayDate;
      }).length;
      
      // If we have no real events, show some default historical counts for visual aesthetics
      const finalCount = events.length === 0 ? mockCounts[6 - i] : count;
      result.push({ day: dayName, count: finalCount });
    }
    return result;
  }

  function loadStats() {
    const events = JSON.parse(localStorage.getItem("ve_events") || "[]");
    
    const total = events.length || 68; // fallback demo baseline
    const today = events.filter(e => {
      const timestampMs = e.timestamp ? (e.timestamp * 1000) : Date.now();
      return new Date(timestampMs).toDateString() === new Date().toDateString();
    }).length || 3;
    
    const sumConf = events.reduce((sum, e) => sum + (parseInt(e.confidence) || 0), 0);
    const avgAccuracy = events.length ? Math.round(sumConf / events.length) : 92;

    const stats = {
      total: total,
      today: today,
      accuracy: avgAccuracy,
      weekly: getMockWeeklyData(events)
    };
    
    updateStats(stats);
  }

  function updateStats(stats) {
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set("statTotal", stats.total ?? "—");
    set("statToday", stats.today ?? "—");
    set("statAccuracy", stats.accuracy != null ? stats.accuracy + "%" : "—%");
    set("statCameras", document.getElementById("activeCamBadge")?.textContent || "1");

    // Weekly chart
    if (stats.weekly && stats.weekly.length) {
      const labels = stats.weekly.map(d => d.day);
      const data = stats.weekly.map(d => d.count);
      initWeeklyChart(labels, data);
    } else {
      initWeeklyChart(["Mon","Tue","Wed","Thu","Fri","Sat","Sun"], [0,0,0,0,0,0,0]);
    }

    // Activity breakdown
    const events = JSON.parse(localStorage.getItem("ve_events") || "[]");
    const counts = {};
    
    if (events.length > 0) {
      events.forEach(e => {
        const key = e.activity_type.length > 25 ? e.activity_type.substring(0, 25) + "…" : e.activity_type;
        counts[key] = (counts[key] || 0) + 1;
      });
    } else {
      // Default demo distribution
      counts["Suspicious Movement"] = 18;
      counts["Restricted Area Stay"] = 12;
      counts["Object Concealed"] = 5;
      counts["Unscanned Item Taken"] = 3;
    }

    const labels = Object.keys(counts);
    const data = Object.values(counts);
    if (labels.length) {
      initActivityChart(labels, data);
    } else {
      initActivityChart(["No Data Yet"], [1]);
    }

    initHourlyChart();
  }

  return { loadStats, updateStats, initWeeklyChart, initActivityChart, initHourlyChart };
})();

// Load charts when stats section is shown
document.addEventListener("DOMContentLoaded", () => {
  // Charts load on demand (when section is visible)
});
