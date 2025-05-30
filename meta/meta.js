import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm";
import scrollama from "https://cdn.jsdelivr.net/npm/scrollama@3.2.0/+esm";

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
    .data(sortedCommits, (d) => d.id)
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
  return groupedData
    .map(([commit, lines]) => {
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
    })
    .sort((a, b) => a.datetime - b.datetime); // Sort commits by datetime
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

  // Filter data by commitMaxTime as well
  const filteredData = data.filter((d) => d.datetime <= commitMaxTime);

  // Update the scatter plot with filtered commits
  updateScatterPlot(filteredData, filteredCommits);

  // Update file visualization
  updateFileVisualization();

  // Update stats with filtered data
  updateStats(filteredData, filteredCommits);
}

// FIXED: File visualization function with proper unit visualization
function updateFileVisualization() {
  // Get lines from filtered commits
  let lines = filteredCommits.flatMap((d) => d.lines);
  let files = d3
    .groups(lines, (d) => d.file)
    .map(([name, lines]) => {
      // Extract file extension to determine type
      const extension = name.split(".").pop().toLowerCase();
      return { name, lines, type: extension };
    })
    .sort((a, b) => b.lines.length - a.lines.length);

  let colors = d3.scaleOrdinal(d3.schemeTableau10);

  // Use D3 to update the files container
  let filesContainer = d3
    .select("#files")
    .selectAll("div")
    .data(files, (d) => d.name)
    .join(
      // This code only runs when the div is initially rendered
      (enter) =>
        enter.append("div").call((div) => {
          div.append("dt");
          div.append("dd");
        }),
    )
    .style("--color", (d) => colors(d.type)); // Fixed: Set CSS custom property

  // Update the dt content with file name and line count
  filesContainer.select("dt").html(
    (d) => `
    <code>${d.name}</code>
    <small style="display: block; font-size: 0.8em; opacity: 0.7; font-weight: normal;">
      ${d.lines.length} lines
    </small>
  `,
  );

  // FIXED: Create unit visualization - one div per line with proper class and styling
  filesContainer
    .select("dd")
    .selectAll("div.loc") // Specify class selector to avoid conflicts
    .data((d) => d.lines)
    .join("div")
    .attr("class", "loc")
    .style("background", (d) => colors(d.type)); // Apply color directly to each unit
}

// Render Commit Info
function renderCommitInfo(data, commits) {
  const dl = d3.select("#stats").append("dl").attr("class", "stats");

  // Create placeholder elements that will be updated
  // Total LOC
  dl.append("dt").html('Total <abbr title="Lines of code">LOC</abbr>');
  dl.append("dd").attr("id", "total-loc");

  // Total commits
  dl.append("dt").text("Total commits");
  dl.append("dd").attr("id", "total-commits");

  // Number of files in the codebase
  dl.append("dt").text("Number of files");
  dl.append("dd").attr("id", "num-files");

  // Longest line (in characters)
  dl.append("dt").text("Longest line (chars)");
  dl.append("dd").attr("id", "longest-line");

  // Average line length (in characters)
  dl.append("dt").text("Avg line length");
  dl.append("dd").attr("id", "avg-line-length");

  // Maximum file length (in lines)
  dl.append("dt").text("Max file length");
  dl.append("dd").attr("id", "max-file-length");

  // Average file length (in lines)
  dl.append("dt").text("Avg file length");
  dl.append("dd").attr("id", "avg-file-length");

  // Average file depth (max depth per file averaged)
  dl.append("dt").text("Avg file depth");
  dl.append("dd").attr("id", "avg-file-depth");

  // Initialize with full data
  updateStats(data, commits);
}

// New function to update stats
function updateStats(data, commits) {
  // Total LOC
  d3.select("#total-loc").text(data.length);

  // Total commits
  d3.select("#total-commits").text(commits.length);

  // Number of files in the codebase
  const numFiles = d3.group(data, (d) => d.file).size;
  d3.select("#num-files").text(numFiles);

  // Longest line (in characters)
  const longestLine = data.length > 0 ? d3.max(data, (d) => d.length) : 0;
  d3.select("#longest-line").text(longestLine);

  // Average line length (in characters)
  const avgLineLength = data.length > 0 ? d3.mean(data, (d) => d.length) : 0;
  d3.select("#avg-line-length").text(avgLineLength.toFixed(1));

  // Maximum file length (in lines)
  if (data.length > 0) {
    const fileLengths = d3.rollups(
      data,
      (v) => d3.max(v, (d) => d.line),
      (d) => d.file,
    );
    const maxFileLength = d3.max(fileLengths, (d) => d[1]);
    d3.select("#max-file-length").text(maxFileLength);

    // Average file length (in lines)
    const avgFileLength = d3.mean(fileLengths, (d) => d[1]);
    d3.select("#avg-file-length").text(avgFileLength.toFixed(1));
  } else {
    d3.select("#max-file-length").text(0);
    d3.select("#avg-file-length").text("0.0");
  }

  // Average file depth (max depth per file averaged)
  if (data.length > 0) {
    const fileDepths = d3.rollups(
      data,
      (v) => d3.max(v, (d) => d.depth),
      (d) => d.file,
    );
    const avgFileDepth = d3.mean(fileDepths, (d) => d[1]);
    d3.select("#avg-file-depth").text(avgFileDepth.toFixed(2));
  } else {
    d3.select("#avg-file-depth").text("0.00");
  }
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
    .data(sortedCommits, (d) => d.id)
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
  const time = document.getElementById("commit-time-tooltip"); // Changed ID
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

// Scrollama functions
function onStepEnter(response) {
  const commitData = response.element.__data__;
  const commitDateTime = commitData.datetime;

  // Filter commits up to the current commit's datetime
  filteredCommits = commits.filter((d) => d.datetime <= commitDateTime);

  // Filter data by the same datetime
  const filteredData = data.filter((d) => d.datetime <= commitDateTime);

  // Update the scatter plot with filtered commits
  updateScatterPlot(filteredData, filteredCommits);

  // Update file visualization
  updateFileVisualization();

  // Update stats with filtered data
  updateStats(filteredData, filteredCommits);

  // Update the slider to match the current commit
  const sliderValue = timeScale(commitDateTime);
  document.getElementById("commit-progress").value = sliderValue;

  // Update time display
  const timeElement = document.getElementById("commit-time");
  timeElement.textContent = commitDateTime.toLocaleString("en", {
    dateStyle: "long",
    timeStyle: "short",
  });
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

  // Generate commit text for scrollytelling
  d3.select("#scatter-story")
    .selectAll(".step")
    .data(commits)
    .join("div")
    .attr("class", "step")
    .html(
      (d, i) => `
      <p>On ${d.datetime.toLocaleString("en", {
        dateStyle: "full",
        timeStyle: "short",
      })},
      I made <a href="${d.url}" target="_blank">${
        i > 0
          ? "another glorious commit"
          : "my first commit, and it was glorious"
      }</a>.
      I edited ${d.totalLines} lines across ${
        d3.rollups(
          d.lines,
          (D) => D.length,
          (d) => d.file,
        ).length
      } files.
      Then I looked over all I had made, and I saw that it was very good.</p>
    `,
    );

  // Set up Scrollama
  const scroller = scrollama();
  scroller
    .setup({
      container: "#scrolly-1",
      step: "#scrolly-1 .step",
    })
    .onStepEnter(onStepEnter);

  // Set up event listener for the slider AFTER renderScatterPlot
  const slider = document.getElementById("commit-progress");
  slider.addEventListener("input", onTimeSliderChange);

  // Initialize the time display, file visualization, and stats
  onTimeSliderChange();
}

main();
