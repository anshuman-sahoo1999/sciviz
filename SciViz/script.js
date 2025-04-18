const { jsPDF } = window.jspdf;
const chartTypeSelect = document.getElementById('chartType');
const dataFileInput = document.getElementById('dataFile');
const manualDataInput = document.getElementById('manualData');
const languageSelect = document.getElementById('languageSelect');
const addAnnotationBtn = document.getElementById('addAnnotation');
const exportPngBtn = document.getElementById('exportPng');
const exportSvgBtn = document.getElementById('exportSvg');
const exportPdfBtn = document.getElementById('exportPdf');
const saveOfflineBtn = document.getElementById('saveOffline');
const loadOfflineBtn = document.getElementById('loadOffline');
const themeToggle = document.getElementById('themeToggle');
const chartSvg = d3.select('#chart');
const tooltip = d3.select('body').append('div').attr('class', 'tooltip').style('opacity', 0);

let data = [];
let chartWidth, chartHeight;
const colors = ['#007bff', '#00d4ff', '#28a745', '#ff6f61', '#f1c40f', '#9b59b6', '#e74c3c'];

// Language Support
const translations = {
  en: { error: 'Error', close: 'Close', fileError: 'Error parsing file' },
  es: { error: 'Error', close: 'Cerrar', fileError: 'Error al analizar el archivo' },
  fr: { error: 'Erreur', close: 'Fermer', fileError: 'Erreur lors de l’analyse du fichier' }
};

function updateLanguage() {
  const lang = languageSelect.value;
  document.getElementById('errorModalLabel').textContent = translations[lang].error;
  document.querySelector('#errorModal .btn-secondary').textContent = translations[lang].close;
}

function initChart() {
  const container = document.querySelector('.chart-container');
  chartWidth = container.clientWidth;
  chartHeight = container.clientHeight;
  chartSvg.attr('width', chartWidth).attr('height', chartHeight);
}

function renderChart(chartType) {
  chartSvg.selectAll('*').remove();
  if (!data.length) return;

  const margin = { top: 40, right: 40, bottom: 60, left: 60 };
  const width = chartWidth - margin.left - margin.right;
  const height = chartHeight - margin.top - margin.bottom;
  const g = chartSvg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  if (['pie', 'doughnut'].includes(chartType)) {
    const radius = Math.min(width, height) / 2;
    const arc = d3.arc().innerRadius(chartType === 'doughnut' ? radius * 0.4 : 0).outerRadius(radius);
    const pie = d3.pie().value(d => d.y);
    const arcs = g.selectAll('.arc')
      .data(pie(data))
      .enter()
      .append('g')
      .attr('class', 'arc')
      .attr('transform', `translate(${width / 2},${height / 2})`);

    arcs.append('path')
      .attr('d', arc)
      .attr('fill', (d, i) => colors[i % colors.length])
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
      .transition()
      .duration(1000)
      .attrTween('d', function(d) {
        const i = d3.interpolate({ startAngle: 0, endAngle: 0 }, d);
        return t => arc(i(t));
      })
      .on('end', () => arcs.attr('opacity', 1));

    arcs.on('mouseover', (event, d) => {
      tooltip.transition().duration(200).style('opacity', 0.9);
      tooltip.html(`Value: ${d.data.y}`)
        .style('left', `${event.pageX + 5}px`)
        .style('top', `${event.pageY - 28}px`);
    }).on('mouseout', () => tooltip.transition().duration(500).style('opacity', 0));
  } else {
    const x = d3.scaleLinear().domain(d3.extent(data, d => d.x)).range([0, width]);
    const y = d3.scaleLinear().domain([0, d3.max(data, d => d.y)]).range([height, 0]);

    g.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(x))
      .attr('aria-label', 'X-axis');
    g.append('g')
      .call(d3.axisLeft(y))
      .attr('aria-label', 'Y-axis');

    if (chartType === 'scatter') {
      g.selectAll('circle')
        .data(data)
        .enter()
        .append('circle')
        .attr('cx', d => x(d.x))
        .attr('cy', d => y(d.y))
        .attr('r', 0)
        .attr('fill', (d, i) => colors[i % colors.length])
        .transition()
        .duration(1000)
        .attr('r', 8)
        .on('end', function() { d3.select(this).attr('opacity', 1); })
        .on('mouseover', (event, d) => {
          tooltip.transition().duration(200).style('opacity', 0.9);
          tooltip.html(`X: ${d.x}<br>Y: ${d.y}`)
            .style('left', `${event.pageX + 5}px`)
            .style('top', `${event.pageY - 28}px`);
        })
        .on('mouseout', () => tooltip.transition().duration(500).style('opacity', 0));
    } else if (chartType === 'line') {
      const line = d3.line().x(d => x(d.x)).y(d => y(d.y));
      g.append('path')
        .datum(data)
        .attr('fill', 'none')
        .attr('stroke', colors[0])
        .attr('stroke-width', 3)
        .attr('d', line)
        .attr('stroke-dasharray', function() {
          const length = this.getTotalLength();
          return `${length} ${length}`;
        })
        .attr('stroke-dashoffset', function() {
          return this.getTotalLength();
        })
        .transition()
        .duration(1500)
        .attr('stroke-dashoffset', 0);
    } else if (chartType === 'bar') {
      g.selectAll('rect')
        .data(data)
        .enter()
        .append('rect')
        .attr('x', d => x(d.x) - width / data.length / 4)
        .attr('y', height)
        .attr('width', width / data.length / 2)
        .attr('height', 0)
        .attr('fill', (d, i) => colors[i % colors.length])
        .transition()
        .duration(1000)
        .attr('y', d => y(d.y))
        .attr('height', d => height - y(d.y));
    } else if (chartType === 'area') {
      const area = d3.area().x(d => x(d.x)).y0(height).y1(d => y(d.y));
      g.append('path')
        .datum(data)
        .attr('fill', colors[0])
        .attr('opacity', 0.6)
        .attr('d', area)
        .transition()
        .duration(1000)
        .attr('opacity', 1);
    } else if (chartType === 'heatmap') {
      const xBins = d3.histogram().value(d => d.x).thresholds(20)(data);
      const yBins = d3.histogram().value(d => d.y).thresholds(20)(data);
      g.selectAll('rect')
        .data(xBins.map((xb, i) => yBins.map((yb, j) => ({ x: xb.x0, y: yb.x0, count: Math.random() }))))
        .enter()
        .append('rect')
        .attr('x', d => x(d.x))
        .attr('y', d => y(d.y))
        .attr('width', width / 20)
        .attr('height', height / 20)
        .attr('fill', d => d3.interpolateBlues(d.count))
        .transition()
        .duration(1000)
        .attr('opacity', 1);
    } else if (chartType === 'bubble') {
      g.selectAll('circle')
        .data(data)
        .enter()
        .append('circle')
        .attr('cx', d => x(d.x))
        .attr('cy', d => y(d.y))
        .attr('r', d => Math.sqrt(d.y) * 5)
        .attr('fill', (d, i) => colors[i % colors.length])
        .attr('opacity', 0.7)
        .transition()
        .duration(1000)
        .attr('opacity', 1);
    }
  }

  // AI-driven Insights (Simple Trend Detection)
  if (data.length > 1) {
    const trend = data[1].y > data[0].y ? 'Increasing' : 'Decreasing';
    tooltip.transition().duration(200).style('opacity', 0.9);
    tooltip.html(`Trend: ${trend}`)
      .style('left', '20px')
      .style('top', '20px');
    setTimeout(() => tooltip.transition().duration(500).style('opacity', 0), 3000);
  }
}

function handleFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      if (file.name.endsWith('.csv')) {
        data = d3.csvParse(e.target.result, d => ({ x: +d.x, y: +d.y }));
      } else if (file.name.endsWith('.json')) {
        data = JSON.parse(e.target.result);
      }
      renderChart(chartTypeSelect.value);
    } catch (err) {
      showError(`${translations[languageSelect.value].fileError}: ${err.message}`);
    }
  };
  reader.readAsText(file);
}

function handleManualData() {
  try {
    data = JSON.parse(manualDataInput.value || '[]');
    renderChart(chartTypeSelect.value);
  } catch (err) {
    showError(`${translations[languageSelect.value].fileError}: ${err.message}`);
  }
}

function showError(message) {
  const errorModal = new bootstrap.Modal(document.getElementById('errorModal'));
  document.getElementById('errorMessage').textContent = message;
  errorModal.show();
}

function addAnnotation() {
  const text = prompt('Enter annotation text:');
  if (text) {
    chartSvg.append('text')
      .attr('x', chartWidth / 2)
      .attr('y', 20)
      .attr('fill', '#007bff')
      .attr('font-size', '14px')
      .attr('text-anchor', 'middle')
      .text(text)
      .transition()
      .duration(500)
      .attr('y', 30);
  }
}

function exportPng() {
  html2canvas(document.querySelector('.chart-container')).then(canvas => {
    const link = document.createElement('a');
    link.download = 'chart.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  });
}

function exportSvg() {
  const svgData = new XMLSerializer().serializeToString(chartSvg.node());
  const blob = new Blob([svgData], { type: 'image/svg+xml' });
  const link = document.createElement('a');
  link.download = 'chart.svg';
  link.href = URL.createObjectURL(blob);
  link.click();
}

function exportPdf() {
  html2canvas(document.querySelector('.chart-container')).then(canvas => {
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF();
    pdf.addImage(imgData, 'PNG', 10, 10, 190, 120);
    pdf.save('chart.pdf');
  });
}

function saveOffline() {
  const saveData = { data, chartType: chartTypeSelect.value };
  localStorage.setItem('sciVizData', JSON.stringify(saveData));
  alert('Data saved offline!');
}

function loadOffline() {
  const saved = localStorage.getItem('sciVizData');
  if (saved) {
    const { data: savedData, chartType } = JSON.parse(saved);
    data = savedData;
    chartTypeSelect.value = chartType;
    renderChart(chartType);
  } else {
    alert('No offline data found.');
  }
}

// Plugin System (Example)
const plugins = {};
function registerPlugin(name, renderFn) {
  plugins[name] = renderFn;
}

chartTypeSelect.addEventListener('change', () => renderChart(chartTypeSelect.value));
dataFileInput.addEventListener('change', handleFileUpload);
manualDataInput.addEventListener('input', handleManualData);
languageSelect.addEventListener('change', updateLanguage);
addAnnotationBtn.addEventListener('click', addAnnotation);
exportPngBtn.addEventListener('click', exportPng);
exportSvgBtn.addEventListener('click', exportSvg);
exportPdfBtn.addEventListener('click', exportPdf);
saveOfflineBtn.addEventListener('click', saveOffline);
loadOfflineBtn.addEventListener('click', loadOffline);
themeToggle.addEventListener('click', () => document.body.classList.toggle('dark-theme'));
window.addEventListener('resize', initChart);

initChart();
updateLanguage();