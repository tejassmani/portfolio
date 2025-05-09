import { fetchJSON, renderProjects } from "../global.js";
import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm";

// Fetch project data
const projects = await fetchJSON("../lib/projects.json");

// Select containers
const projectsContainer = document.querySelector(".projects");
const searchInput = document.querySelector(".searchBar");

// Initial render of all projects
renderProjects(projects, projectsContainer, "h2");

// Color scale (reuse this globally so legend and chart match)
const colors = d3.scaleOrdinal(d3.schemeTableau10);

// Variable to store the selected year (if any)
let selectedYear = null;

// Chart rendering function
function renderPieChart(projectsGiven) {
  // Clear previous chart and legend
  d3.select("#projects-plot").selectAll("path").remove();
  d3.select(".legend").selectAll("li").remove();

  // Roll up data by year
  let rolledData = d3.rollups(
    projectsGiven,
    (v) => v.length,
    (d) => d.year,
  );

  // Prepare data format
  let data = rolledData.map(([year, count]) => ({
    value: count,
    label: year,
  }));

  // Skip if no data
  if (data.length === 0) return;

  // Arc + pie generators
  const arcGenerator = d3.arc().innerRadius(0).outerRadius(50);
  const sliceGenerator = d3.pie().value((d) => d.value);
  const arcData = sliceGenerator(data);
  const arcs = arcData.map((d) => arcGenerator(d));

  // Draw arcs
  arcs.forEach((arc, idx) => {
    d3.select("#projects-plot")
      .append("path")
      .attr("d", arc)
      .attr("fill", colors(idx))
      .attr("class", "arc") // Add the 'arc' class
      .style("cursor", "pointer") // Add cursor: pointer to show it's clickable
      .on("click", () => {
        const clickedYear = data[idx].label;

        // If the clicked year is already the selected one, reset
        if (selectedYear === clickedYear) {
          selectedYear = null; // Reset the selected year
          renderProjects(projects, projectsContainer, "h2"); // Restore the full project list
        } else {
          selectedYear = clickedYear; // Set the selected year
          const filteredProjects = projects.filter(
            (project) => project.year === clickedYear,
          );
          renderProjects(filteredProjects, projectsContainer, "h2"); // Render filtered projects
        }

        // Re-render the pie chart with the current filtered data (if any)
        renderPieChart(projects);
      });
  });

  // Draw legend
  let legend = d3.select(".legend");
  data.forEach((d, idx) => {
    legend
      .append("li")
      .attr("class", "legend-item")
      .attr("style", `--color:${colors(idx)}`)
      .html(
        `<span class="swatch" style="background:${colors(idx)}"></span> ${d.label} <em>(${d.value})</em>`,
      );
  });
}

// Initial pie chart render
renderPieChart(projects);

// Search functionality
searchInput.addEventListener("input", (event) => {
  let query = event.target.value.toLowerCase();

  let filteredProjects = projects.filter((project) => {
    let values = Object.values(project).join("\n").toLowerCase();
    return values.includes(query);
  });

  renderProjects(filteredProjects, projectsContainer, "h2");
  renderPieChart(filteredProjects);
});
