import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm";

// Define global scale variables
let xScale;
let yScale;
let commits;
let commitProgress = 100;
let timeScale;
let commitMaxTime;
// Will get updated as user changes slider
let filteredCommits;
let data; // Make data global so it can be accessed in onTimeSliderChange

// Load Data
async function loadData() {
  const data = await d3.csv("loc.csv", (row) => ({
    ...row,
    line: Number(row.line),
    depth: Number(row.depth),
    length: Number(row.length),
    date: new Date(row.date + "T00:00" + row.timezone),
    datetime: new Date(row.datetime),
  }));

  return data;
}

// Update scatter plot function to handle filtered data
function updateScatterPlot(data, commits) {
  const width = 1000;
  const height = 600;
  const margin = { top: 10, right: 10, bottom: 30, left: 20 };
  const usableArea = {
    top: margin.top,
    right: width - margin.right,
    bottom: height - margin.bottom,
    left: margin.left,
    width: width - margin.left - margin.right,
    height: height - margin.top - margin.bottom,
  };

  const svg = d3.select("#chart").select("svg");

  // Update the domain of the existing xScale
  xScale.domain(d3.extent(commits, (d) => d.datetime));

  const [minLines, maxLines] = d3.extent(commits, (d) => d.totalLines);
  const rScale = d3.scaleSqrt().domain([minLines, maxLines]).range([2, 30]);

  const xAxis = d3.axisBottom(xScale);

  // Update the x-axis
  const xAxisGroup = svg.select("g.x-axis");
  xAxisGroup.selectAll("*").remove();
  xAxisGroup.call(xAxis);

  const dots = svg.select("g.dots");

  const sortedCommits = d3.sort(commits, (d) => -d.totalLines);
  dots
    .selectAll("circle")
    .data(sortedCommits)
    .join("circle")
    .attr("cx", (d) => xScale(d.datetime))
    .attr("cy", (d) => yScale(d.hourFrac))
    .attr("r", (d) => rScale(d.totalLines))
    .attr("fill", "steelblue")
    .style("fill-opacity", 0.7)
    .on("mouseenter", (event, commit) => {
      d3.select(event.currentTarget).style("fill-opacity", 1);
      renderTooltipContent(commit, event);
      updateTooltipVisibility(true);
      updateTooltipPosition(event);
    })
    .on("mouseleave", (event) => {
      d3.select(event.currentTarget).style("fill-opacity", 0.7);
      updateTooltipVisibility(false);
    });
}

// Process commits
function processCommits(data) {
  const groupedData = d3.groups(data, (d) => d.commit);
  return groupedData.map(([commit, lines]) => {
    let first = lines[0];
    let { author, date, time, timezone, datetime } = first;

    let ret = {
      id: commit,
      url: "https://github.com/vis-society/lab-7/commit/" + commit,
      author,
      date,
      time,
      timezone,
      datetime,
      hourFrac: datetime.getHours() + datetime.getMinutes() / 60,
      totalLines: lines.length,
      lines: lines, // Keep lines accessible
    };

    return ret;
  });
}

// Time slider change handler
function onTimeSliderChange() {
  const slider = document.getElementById("commit-progress");
  commitProgress = +slider.value;
  commitMaxTime = timeScale.invert(commitProgress);

  const timeElement = document.getElementById("commit-time");
  timeElement.textContent = commitMaxTime.toLocaleString("en", {
    dateStyle: "long",
    timeStyle: "short",
  });

  // Filter commits by commitMaxTime
  filteredCommits = commits.filter((d) => d.datetime <= commitMaxTime);

  // Update the scatter plot with filtered commits
  updateScatterPlot(data, filteredCommits);
}

// Render Commit Info
function renderCommitInfo(data, commits) {
  const dl = d3.select("#stats").append("dl").attr("class", "stats");

  // Total LOC
  dl.append("dt").html('Total <abbr title="Lines of code">LOC</abbr>');
  dl.append("dd").text(data.length);

  // Total commits
  dl.append("dt").text("Total commits");
  dl.append("dd").text(commits.length);

  // Number of files in the codebase
  const numFiles = d3.group(data, (d) => d.file).size;
  dl.append("dt").text("Number of files");
  dl.append("dd").text(numFiles);

  // Longest line (in characters)
  const longestLine = d3.max(data, (d) => d.length);
  dl.append("dt").text("Longest line (chars)");
  dl.append("dd").text(longestLine);

  // Average line length (in characters)
  const avgLineLength = d3.mean(data, (d) => d.length);
  dl.append("dt").text("Avg line length");
  dl.append("dd").text(avgLineLength.toFixed(1));

  // Maximum file length (in lines)
  const fileLengths = d3.rollups(
    data,
    (v) => d3.max(v, (d) => d.line),
    (d) => d.file,
  );
  const maxFileLength = d3.max(fileLengths, (d) => d[1]);
  dl.append("dt").text("Max file length");
  dl.append("dd").text(maxFileLength);

  // Average file length (in lines)
  const avgFileLength = d3.mean(fileLengths, (d) => d[1]);
  dl.append("dt").text("Avg file length");
  dl.append("dd").text(avgFileLength.toFixed(1));

  // Average file depth (max depth per file averaged)
  const fileDepths = d3.rollups(
    data,
    (v) => d3.max(v, (d) => d.depth),
    (d) => d.file,
  );
  const avgFileDepth = d3.mean(fileDepths, (d) => d[1]);
  dl.append("dt").text("Avg file depth");
  dl.append("dd").text(avgFileDepth.toFixed(2));

  // Time of day most work is done (morning, afternoon, evening, night)
  const timeOfDay = (hour) => {
    if (hour >= 5 && hour < 12) return "Morning";
    if (hour >= 12 && hour < 17) return "Afternoon";
    if (hour >= 17 && hour < 21) return "Evening";
    return "Night";
  };

  const workByTimePeriod = d3.rollups(
    data,
    (v) => v.length,
    (d) => timeOfDay(new Date(d.datetime).getHours()),
  );
  const mostActivePeriod = d3.max(workByTimePeriod, (d) => d[1])?.[0];
  dl.append("dt").text("Most active time");
  dl.append("dd").text(mostActivePeriod);

  // Day of the week most work is done
  const dayNames = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  const workByDay = d3.rollups(
    data,
    (v) => v.length,
    (d) => new Date(d.datetime).getDay(),
  );
  const mostActiveDay = d3.max(workByDay, (d) => d[1])?.[0];
  dl.append("dt").text("Most active day");
  dl.append("dd").text(dayNames[mostActiveDay]);
}

// Render Scatter Plot
function renderScatterPlot(data, allCommits) {
  const width = 1000;
  const height = 600;

  const sortedCommits = d3.sort(allCommits, (d) => -d.totalLines);
  const svg = d3
    .select("#chart")
    .append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .style("overflow", "visible");

  // Update global scale variables
  xScale = d3
    .scaleTime()
    .domain(d3.extent(allCommits, (d) => d.datetime))
    .range([0, width])
    .nice();

  yScale = d3.scaleLinear().domain([0, 24]).range([height, 0]);

  const margin = { top: 10, right: 10, bottom: 30, left: 20 };
  const usableArea = {
    top: margin.top,
    right: width - margin.right,
    bottom: height - margin.bottom,
    left: margin.left,
    width: width - margin.left - margin.right,
    height: height - margin.top - margin.bottom,
  };

  // Update scales with new ranges
  xScale.range([usableArea.left, usableArea.right]);
  yScale.range([usableArea.bottom, usableArea.top]);

  const dots = svg.append("g").attr("class", "dots");

  const [minLines, maxLines] = d3.extent(allCommits, (d) => d.totalLines);
  const rScale = d3
    .scaleSqrt() // Change only this line
    .domain([minLines, maxLines])
    .range([2, 30]);
  dots
    .selectAll("circle")
    .data(sortedCommits)
    .join("circle")
    .attr("cx", (d) => xScale(d.datetime))
    .attr("cy", (d) => yScale(d.hourFrac))
    .attr("r", (d) => rScale(d.totalLines))
    .attr("fill", "steelblue")
    .style("fill-opacity", 0.7) // Add default opacity
    .on("mouseenter", (event, commit) => {
      d3.select(event.currentTarget).style("fill-opacity", 1); // Full opacity on hover
      renderTooltipContent(commit, event);
      updateTooltipVisibility(true); // Show tooltip on hover
      updateTooltipPosition(event);
    })
    .on("mouseleave", (event) => {
      d3.select(event.currentTarget).style("fill-opacity", 0.7);
      updateTooltipVisibility(false); // Hide tooltip when not hovering
    });

  // Add gridlines BEFORE the axes
  const gridlines = svg
    .append("g")
    .attr("class", "gridlines")
    .attr("transform", `translate(${usableArea.left}, 0)`);

  gridlines.call(
    d3.axisLeft(yScale).tickFormat("").tickSize(-usableArea.width),
  );

  // Create the axes
  const xAxis = d3.axisBottom(xScale);
  const yAxis = d3.axisLeft(yScale);

  svg
    .append("g")
    .attr("transform", `translate(0, ${usableArea.bottom})`)
    .attr("class", "x-axis") // new line to mark the g tag
    .call(xAxis);

  svg
    .append("g")
    .attr("transform", `translate(${usableArea.left}, 0)`)
    .attr("class", "y-axis") // just for consistency
    .call(yAxis);

  // Step 5.1: Setting up the brush
  createBrushSelector(svg);

  // Create CSS style for selected dots
  const style = document.createElement("style");
  style.textContent = `
    circle.selected {
      fill: #ff6b6b;
    }
  `;
  document.head.appendChild(style);

  // Add elements for selection count and language breakdown
  const statsContainer = document.querySelector("#stats");

  // Create selection count paragraph if it doesn't exist
  if (!document.querySelector("#selection-count")) {
    const selectionCount = document.createElement("p");
    selectionCount.id = "selection-count";
    selectionCount.textContent = "No commits selected";
    statsContainer.appendChild(selectionCount);
  }

  // Create language breakdown container if it doesn't exist
  if (!document.querySelector("#language-breakdown")) {
    const languageBreakdownTitle = document.createElement("h3");
    languageBreakdownTitle.textContent = "Language Breakdown";
    statsContainer.appendChild(languageBreakdownTitle);

    const languageBreakdown = document.createElement("dl");
    languageBreakdown.id = "language-breakdown";
    statsContainer.appendChild(languageBreakdown);
  }
}

// Step 5.4: Making the brush actually select dots
function brushed(event) {
  // Prevent event propagation to avoid interfering with other interactions
  if (event.sourceEvent && event.sourceEvent.type === "mousemove") {
    event.sourceEvent.stopPropagation();
  }

  const selection = event.selection;
  d3.selectAll("circle").classed("selected", (d) =>
    isCommitSelected(selection, d),
  );

  // Step 5.5: Showing count of selected commits
  const selectedCommits = renderSelectionCount(selection);

  // Step 5.6: Showing language breakdown
  renderLanguageBreakdown(selection);
}

function isCommitSelected(selection, commit) {
  if (!selection) {
    return false;
  }

  const [x0, x1] = selection.map((d) => d[0]);
  const [y0, y1] = selection.map((d) => d[1]);

  const x = xScale(commit.datetime);
  const y = yScale(commit.hourFrac);

  return x >= x0 && x <= x1 && y >= y0 && y <= y1;
}

function renderSelectionCount(selection) {
  const selectedCommits = selection
    ? commits.filter((d) => isCommitSelected(selection, d))
    : [];

  const countElement = document.querySelector("#selection-count");
  countElement.textContent = `${
    selectedCommits.length || "No"
  } commits selected`;

  return selectedCommits;
}

function renderLanguageBreakdown(selection) {
  const selectedCommits = selection
    ? commits.filter((d) => isCommitSelected(selection, d))
    : [];

  const container = document.getElementById("language-breakdown");

  if (selectedCommits.length === 0) {
    container.innerHTML = "";
    return;
  }

  const requiredCommits = selectedCommits.length ? selectedCommits : commits;
  const lines = requiredCommits.flatMap((d) => d.lines);

  // Use d3.rollup to count lines per language
  const breakdown = d3.rollup(
    lines,
    (v) => v.length,
    (d) => d.type,
  );

  // Update DOM with breakdown
  container.innerHTML = "";

  for (const [language, count] of breakdown) {
    const proportion = count / lines.length;
    const formatted = d3.format(".1~%")(proportion);

    container.innerHTML += `
      <dt>${language}</dt>
      <dd>${count} lines (${formatted})</dd>
    `;
  }
}

// Function to set up the brush
function createBrushSelector(svg) {
  // Create a dedicated group for the brush to prevent it from interfering with other elements
  const brushGroup = svg.append("g").attr("class", "brush-group");

  // Create brush with extent matching the chart area
  const margin = { top: 10, right: 10, bottom: 30, left: 20 };
  const width = +svg.attr("viewBox").split(" ")[2];
  const height = +svg.attr("viewBox").split(" ")[3];

  const brush = d3
    .brush()
    .extent([
      [margin.left, margin.top],
      [width - margin.right, height - margin.bottom],
    ])
    .on("start brush end", brushed);

  // Apply brush to the dedicated group
  brushGroup.call(brush);

  // Step 5.2: Getting our tooltips back
  // Raise dots and everything after the brush overlay
  svg.selectAll(".dots").raise();
}

function renderTooltipContent(commit, event) {
  const tooltip = d3.select("#commit-tooltip");

  // Set initial tooltip display and position
  tooltip.style("display", "block");

  // Get the mouse position
  const mouseX = event.pageX + 10; // Add a small offset for space
  const mouseY = event.pageY + 10; // Add a small offset for space

  // Get window width and height
  const windowWidth = window.innerWidth;
  const windowHeight = window.innerHeight;

  // Get tooltip width and height
  const tooltipWidth = tooltip.node().offsetWidth;
  const tooltipHeight = tooltip.node().offsetHeight;

  // Check if the tooltip would overflow the right or bottom edges and adjust
  let adjustedX = mouseX;
  let adjustedY = mouseY;

  // Adjust horizontally if it overflows the right edge
  if (mouseX + tooltipWidth > windowWidth) {
    adjustedX = windowWidth - tooltipWidth - 10; // 10px margin from the right
  }

  // Adjust vertically if it overflows the bottom edge
  if (mouseY + tooltipHeight > windowHeight) {
    adjustedY = windowHeight - tooltipHeight - 10; // 10px margin from the bottom
  }

  // Update tooltip position
  tooltip.style("left", `${adjustedX}px`).style("top", `${adjustedY}px`);

  // Set the tooltip content
  const link = document.getElementById("commit-link");
  const date = document.getElementById("commit-date");
  const time = document.getElementById("commit-time");
  const author = document.getElementById("commit-author");
  const totalLines = document.getElementById("commit-total-lines");

  if (Object.keys(commit).length === 0) return;

  link.href = commit.url;
  link.textContent = commit.id;
  date.textContent = commit.datetime?.toLocaleString("en", {
    dateStyle: "full",
  });
  time.textContent = commit.datetime?.toLocaleTimeString();
  author.textContent = commit.author;
  totalLines.textContent = commit.totalLines;
}

function updateTooltipVisibility(isVisible) {
  const tooltip = document.getElementById("commit-tooltip");
  tooltip.hidden = !isVisible;
}

function updateTooltipPosition(event) {
  const tooltip = document.getElementById("commit-tooltip");
  tooltip.style.left = `${event.clientX}px`;
  tooltip.style.top = `${event.clientY}px`;
}

async function main() {
  data = await loadData(); // Remove const to make it global
  commits = processCommits(data);

  // Initialize time scale after commits are processed
  timeScale = d3
    .scaleTime()
    .domain([
      d3.min(commits, (d) => d.datetime),
      d3.max(commits, (d) => d.datetime),
    ])
    .range([0, 100]);

  commitMaxTime = timeScale.invert(commitProgress);

  // Initialize filteredCommits with all commits
  filteredCommits = commits;

  console.log(commits); // here, commits is defined
  renderCommitInfo(data, commits);
  renderScatterPlot(data, commits);

  // Set up event listener for the slider AFTER renderScatterPlot
  const slider = document.getElementById("commit-progress");
  slider.addEventListener("input", onTimeSliderChange);

  // Initialize the time display
  onTimeSliderChange();
}

main();
