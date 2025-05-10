import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm";

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
    };

    Object.defineProperty(ret, "lines", {
      value: lines,
      writable: false,
      configurable: false,
      enumerable: false,
    });

    return ret;
  });
}

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
  const longestLine = d3.greatest(data, (d) => d.length);
  dl.append("dt").text("Longest line (chars)");
  dl.append("dd").text(longestLine.length);

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
  const mostActivePeriod = d3.greatest(workByTimePeriod, (d) => d[1])?.[0];
  dl.append("dt").text("Most work time");
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
  const mostActiveDay = d3.greatest(workByDay, (d) => d[1])?.[0];
  dl.append("dt").text("Most active day");
  dl.append("dd").text(dayNames[mostActiveDay]);
}

loadData().then((data) => {
  const commits = processCommits(data);
  renderCommitInfo(data, commits);
});
