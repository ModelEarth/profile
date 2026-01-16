// D3 v7 Separated chord chart
// Updated from D3 v3 original version

// Global configuration
const config = {
    margin: {left: 50, top: 10, right: 50, bottom: 120},
    opacity: {
        default: 0.7,
        low: 0.02
    },
    titles: {
        left: "Sectors",
        right: "Indicators"
    },
    chordBorder: {
        style: "light", // Options: "none", "light", "dark"
        width: "1px"
    }
};

// Sample data for testing
const sampleData = {
    nodes: [
        // Sectors
        {id: "sector1", name: "Agriculture", type: "sector", group: 1},
        {id: "sector2", name: "Manufacturing", type: "sector", group: 1},
        // Indicators
        {id: "ind1", name: "CO2", type: "indicator", group: 2},
        {id: "ind2", name: "Water", type: "indicator", group: 2}
    ],
    links: [
        {source: "sector1", target: "ind1", value: 100},
        {source: "sector1", target: "ind2", value: 50},
        {source: "sector2", target: "ind1", value: 75},
        {source: "sector2", target: "ind2", value: 125}
    ]
};

// Global variables
let pullOutSize;

// Custom Chord Function adjusted from the original d3.svg.chord() function
// Modified for D3 v7
function stretchedChord() {
    let source = d => d.source;
    let target = d => d.target;
    let radius = d => d.radius;
    let startAngle = d => d.startAngle;
    let endAngle = d => d.endAngle;
    let pullOutDistance = pullOutSize; // Default to global, can be overridden
    
    const π = Math.PI;
    const halfπ = π / 2;

    function subgroup(self, f, d, i) {
        let subgroup = f(d);
        let r = radius(subgroup);
        let a0 = startAngle(subgroup) - halfπ;
        let a1 = endAngle(subgroup) - halfπ;
        return {
            r: r,
            a0: [a0],
            a1: [a1],
            p0: [r * Math.cos(a0), r * Math.sin(a0)],
            p1: [r * Math.cos(a1), r * Math.sin(a1)]
        };
    }

    function arc(r, p, a) {
        let sign = (p[0] >= 0 ? 1 : -1);
        return "A" + r + "," + r + " 0 " + +(a > π) + ",1 " + (p[0] + sign*pullOutDistance) + "," + p[1];
    }

    function curve(p1) {
        let sign = (p1[0] >= 0 ? 1 : -1);
        return "Q 0,0 " + (p1[0] + sign*pullOutDistance) + "," + p1[1];
    }

    /*
    M = moveto
    M x,y
    Q = quadratic Bézier curve
    Q control-point-x,control-point-y end-point-x, end-point-y
    A = elliptical Arc
    A rx, ry x-axis-rotation large-arc-flag, sweep-flag  end-point-x, end-point-y
    Z = closepath
    */
    function chord(d) {
        let s = subgroup(this, source, d);
        let t = subgroup(this, target, d);
        
        // Apply correct sign for pullout based on position
        let sSign = (s.p0[0] >= 0 ? 1 : -1);
                
        return "M" + (s.p0[0] + sSign*pullOutDistance) + "," + s.p0[1] + 
                arc(s.r, s.p1, s.a1 - s.a0) + 
                curve(t.p0) + 
                arc(t.r, t.p1, t.a1 - t.a0) + 
                curve(s.p0) + 
                "Z";
    }//chord

    chord.radius = function(v) {
        if (!arguments.length) return radius;
        radius = typeof v === "function" ? v : () => v;
        return chord;
    };
    
    chord.source = function(v) {
        if (!arguments.length) return source;
        source = typeof v === "function" ? v : () => v;
        return chord;
    };
    
    chord.target = function(v) {
        if (!arguments.length) return target;
        target = typeof v === "function" ? v : () => v;
        return chord;
    };
    
    chord.startAngle = function(v) {
        if (!arguments.length) return startAngle;
        startAngle = typeof v === "function" ? v : () => v;
        return chord;
    };
    
    chord.endAngle = function(v) {
        if (!arguments.length) return endAngle;
        endAngle = typeof v === "function" ? v : () => v;
        return chord;
    };
    
    chord.pullOutSize = function(v) {
        if (!arguments.length) return pullOutDistance;
        pullOutDistance = v;
        return chord;
    };
    
    return chord;
}

// Custom Chord Layout - updated for D3 v7
function customChordLayout() {
    const τ = 2 * Math.PI;
    let chord = {},
        chords,
        groups,
        matrix,
        n,
        padding = 0,
        sortGroups,
        sortSubgroups,
        sortChords,
        numSectors = 0;  // Number of sectors for separated layout

    function relayout() {
        let subgroups = {};
        let groupSums = [];
        let groupIndex = d3.range(n);
        let subgroupIndex = [];
        let k;
        let x;
        let x0;
        let i;
        let j;
        
        chords = [];
        groups = [];
        
        k = 0, i = -1;
        while (++i < n) {
            x = 0, j = -1;
            while (++j < n) {
                x += matrix[i][j];
            }
            groupSums.push(x);
            subgroupIndex.push(d3.range(n).reverse());
            k += x;
        }
        
        if (sortGroups) {
            groupIndex.sort((a, b) => sortGroups(groupSums[a], groupSums[b]));
        }
        
        if (sortSubgroups) {
            subgroupIndex.forEach((d, i) => {
                d.sort((a, b) => sortSubgroups(matrix[i][a], matrix[i][b]));
            });
        }
        
        // Check if this is a separated chord layout (numSectors > 0)
        if (numSectors > 0) {
            // SEPARATED CHORD LAYOUT for chart2
            const numIndicators = n - numSectors;
            
            // Calculate scaling factors for each side
            let indicatorSum = 0;
            let sectorSum = 0;
            
            // For indicators: sum the data flowing TO them (from all sources)
            for (let i = 0; i < numIndicators; i++) {
                for (let j = 0; j < n; j++) {
                    indicatorSum += matrix[j][i]; // Column sum for indicator i
                }
            }
            
            // For sectors: sum the data flowing FROM them (to all targets)
            for (let i = numIndicators; i < n; i++) {
                for (let j = 0; j < n; j++) {
                    sectorSum += matrix[i][j]; // Row sum for sector i
                }
            }
            
            // Calculate target space for each side
            const indicatorTargetSpace = Math.PI - (padding * numIndicators); // Right side minus padding
            const sectorTargetSpace = (2 * Math.PI) / 3 - (padding * numSectors); // Left side minus padding
            
            // Force indicators to fill their target space completely
            const indicatorScale = indicatorSum > 0 ? indicatorTargetSpace / indicatorSum : 0;
            
            // Scale sectors to fit 1/3 of circumference
            const sectorScale = sectorSum > 0 ? sectorTargetSpace / sectorSum : 0;
            
            // Console log the calculations
            console.log(`Scaling calculations:`);
            console.log(`  Indicators: sum=${indicatorSum.toFixed(6)}, target=${indicatorTargetSpace.toFixed(3)} rad, scale=${indicatorScale.toFixed(3)} (forced to fill right side)`);
            console.log(`  Sectors: sum=${sectorSum.toFixed(6)}, target=${sectorTargetSpace.toFixed(3)} rad (${(sectorTargetSpace/(2*Math.PI)*100).toFixed(1)}% of circle), scale=${sectorScale.toFixed(3)}`);
            console.log(`  Padding: ${padding} per node, total indicator padding=${(padding * numIndicators).toFixed(3)}, total sector padding=${(padding * numSectors).toFixed(3)}`);
            
            // Position indicators on right side (0 to π)
            x = 0;
            for (let i = 0; i < numIndicators; i++) {
                let di = groupIndex[i];
                x0 = x;
                let groupValue = 0;
                
                console.log(`  Positioning indicator ${i} (index ${di}): starting at ${x0.toFixed(3)}`);
                
                // For indicators, use their incoming data (column sum) to determine their arc size
                if (i < numIndicators) {
                    // This is an indicator - calculate its size based on incoming data
                    let indicatorIncomingSum = 0;
                    for (let k = 0; k < n; k++) {
                        indicatorIncomingSum += matrix[k][di]; // Column sum for this indicator
                    }
                    
                    // Give this indicator a proportional share of the target space (but limit to prevent overflow)
                    const maxIndicatorSpace = indicatorTargetSpace * 0.8; // Use only 80% to prevent overflow
                    const indicatorShare = indicatorSum > 0 ? (indicatorIncomingSum / indicatorSum) * maxIndicatorSpace : maxIndicatorSpace / numIndicators;
                    
                    console.log(`    Indicator ${di} incoming sum: ${indicatorIncomingSum.toFixed(6)}, share: ${indicatorShare.toFixed(3)} rad`);
                    
                    // Still need to create all subgroups for compatibility with chord rendering
                    j = -1;
                    while (++j < n) {
                        let dj = subgroupIndex[di][j];
                        let v = matrix[di][dj];
                        let a0 = x;
                        
                        // For the main indicator arc, use the calculated share, for others use zero
                        let arcSize = (j === 0) ? indicatorShare : 0;
                        let a1 = x + arcSize;
                        if (j === 0) x = a1; // Only advance x for the main arc
                        
                        groupValue += (j === 0) ? indicatorIncomingSum : v;
                        
                        subgroups[di + "-" + dj] = {
                            index: di,
                            subindex: dj,
                            startAngle: a0,
                            endAngle: a1,
                            value: (j === 0) ? indicatorIncomingSum : v
                        };
                    }
                } else {
                    // This is a sector - calculate its size based on outgoing data
                    let sectorOutgoingSum = 0;
                    for (let k = 0; k < n; k++) {
                        sectorOutgoingSum += matrix[di][k]; // Row sum for this sector
                    }
                    
                    // Give this sector a proportional share of the target space
                    const sectorShare = sectorSum > 0 ? (sectorOutgoingSum / sectorSum) * sectorTargetSpace : sectorTargetSpace / numSectors;
                    
                    console.log(`    Sector ${di} outgoing sum: ${sectorOutgoingSum.toFixed(6)}, share: ${sectorShare.toFixed(3)} rad`);
                    
                    // Create subgroups proportional to the connections
                    j = -1;
                    let currentX = x;
                    while (++j < n) {
                        let dj = subgroupIndex[di][j];
                        let v = matrix[di][dj];
                        let a0 = currentX;
                        
                        // Proportional size within this sector's share
                        let connectionShare = sectorOutgoingSum > 0 ? (v / sectorOutgoingSum) * sectorShare : 0;
                        let a1 = currentX + connectionShare;
                        currentX = a1;
                        
                        groupValue += v;
                        
                        if (v > 0) {
                            console.log(`    Subgroup ${di}-${dj}: value=${v.toFixed(6)}, share=${connectionShare.toFixed(3)}, angle ${a0.toFixed(3)} to ${a1.toFixed(3)}`);
                        }
                        
                        subgroups[di + "-" + dj] = {
                            index: di,
                            subindex: dj,
                            startAngle: a0,
                            endAngle: a1,
                            value: v
                        };
                    }
                    
                    // Update x to the end of this sector's space
                    x = x + sectorShare;
                }
                
                groups[di] = {
                    index: di,
                    startAngle: x0,
                    endAngle: x,
                    value: groupValue
                };
                
                console.log(`  Indicator ${i} final: ${x0.toFixed(3)} to ${x.toFixed(3)}, span=${(x-x0).toFixed(3)}, groupValue=${groupValue.toFixed(6)}`);
                x += padding;
                console.log(`  After padding: x = ${x.toFixed(3)}`);
            }
            
            // Log final positioning after indicators
            const finalIndicatorSpace = x; // x after indicators positioning
            console.log(`Final positioning:`);
            console.log(`  Indicators occupy: 0 to ${finalIndicatorSpace.toFixed(3)} rad (${(finalIndicatorSpace/Math.PI*100).toFixed(1)}% of π)`);
            
            // Position sectors on left side (starting at π, taking 1/3 of total circumference)
            x = Math.PI;
            for (let i = numIndicators; i < n; i++) {
                let di = groupIndex[i];
                x0 = x;
                let groupValue = 0;
                
                j = -1;
                while (++j < n) {
                    let dj = subgroupIndex[di][j];
                    let v = matrix[di][dj];
                    let a0 = x;
                    let a1 = x += v * sectorScale;
                    groupValue += v;
                    subgroups[di + "-" + dj] = {
                        index: di,
                        subindex: dj,
                        startAngle: a0,
                        endAngle: a1,
                        value: v
                    };
                }
                
                groups[di] = {
                    index: di,
                    startAngle: x0,
                    endAngle: x,
                    value: groupValue
                };
                x += padding;
            }
            
            // Log final positioning after sectors
            console.log(`  Sectors occupy: π (${Math.PI.toFixed(3)}) to ${x.toFixed(3)} rad, total span: ${(x-Math.PI).toFixed(3)} rad (${((x-Math.PI)/(2*Math.PI)*100).toFixed(1)}% of full circle)`);
        } else {
            // NORMAL CHORD LAYOUT for chart1
            k = (τ - padding * n) / k;
            x = 0, i = -1;
            while (++i < n) {
                let di = groupIndex[i];
                x0 = x, j = -1;
                while (++j < n) {
                    let dj = subgroupIndex[di][j];
                    let v = matrix[di][dj];
                    let a0 = x;
                    let a1 = x += v * k;
                    subgroups[di + "-" + dj] = {
                        index: di,
                        subindex: dj,
                        startAngle: a0,
                        endAngle: a1,
                        value: v
                    };
                }
                groups[di] = {
                    index: di,
                    startAngle: x0,
                    endAngle: x,
                    value: (x - x0) / k
                };
                x += padding;
            }
        }
        
        i = -1;
        while (++i < n) {
            j = i - 1;
            while (++j < n) {
                let source = subgroups[i + "-" + j];
                let target = subgroups[j + "-" + i];
                if (source.value || target.value) {
                    chords.push(source.value < target.value ? {
                        source: target,
                        target: source
                    } : {
                        source: source,
                        target: target
                    });
                }
            }
        }
        
        if (sortChords) resort();
    }
    
    function resort() {
        chords.sort((a, b) => sortChords((a.source.value + a.target.value) / 2, (b.source.value + b.target.value) / 2));
    }
    
    chord.matrix = function(x) {
        if (!arguments.length) return matrix;
        n = (matrix = x) && matrix.length;
        chords = groups = null;
        return chord;
    };
    
    chord.padding = function(x) {
        if (!arguments.length) return padding;
        padding = x;
        chords = groups = null;
        return chord;
    };
    
    chord.sortGroups = function(x) {
        if (!arguments.length) return sortGroups;
        sortGroups = x;
        chords = groups = null;
        return chord;
    };
    
    chord.sortSubgroups = function(x) {
        if (!arguments.length) return sortSubgroups;
        sortSubgroups = x;
        chords = null;
        return chord;
    };
    
    chord.sortChords = function(x) {
        if (!arguments.length) return sortChords;
        sortChords = x;
        if (chords) resort();
        return chord;
    };
    
    chord.chords = function() {
        if (!chords) relayout();
        return chords;
    };
    
    chord.groups = function() {
        if (!groups) relayout();
        return groups;
    };
    
    chord.numSectors = function(x) {
        if (!arguments.length) return numSectors;
        numSectors = x;
        chords = groups = null;
        return chord;
    };
    
    return chord;
}

// Screen size detection
const screenWidth = $(window).innerWidth();
const mobileScreen = (screenWidth > 500 ? false : true);

// Margins and dimensions
const margin = {left: 50, top: 10, right: 50, bottom: 10};
const width = Math.min(screenWidth, 800) - margin.left - margin.right;
const height = (mobileScreen ? 300 : Math.min(screenWidth, 800)*5/6) - margin.top - margin.bottom;

// Chart1 DISPLAY
const ENABLE_CHART1 = false;

// Shared variables used by both charts
let svg, wrapper, titleWrapper; // Declare but don't create for chart1

// Set pullout size based on screen (needed by both charts)
pullOutSize = (mobileScreen ? 20 : 50); // Pull distance for arcs

if (ENABLE_CHART1) {
// Create SVG for chart1
svg = d3.select("#chart1").append("svg")
    .attr("width", (width + margin.left + margin.right))
    .attr("height", (height + margin.top + margin.bottom));

// Create wrapper group
const wrapper = svg.append("g")
    .attr("class", "chordWrapper")
    .attr("transform", `translate(${width / 2 + margin.left},${height / 2 + margin.top})`);

// Define dimensions
const outerRadius = Math.min(width, height) / 2 - (mobileScreen ? 80 : 100);
const innerRadius = outerRadius * 0.95;
const opacityDefault = 0.7; // default opacity of chords
const opacityLow = 0.02; // hover opacity of those chords not hovered over

// pullOutSize already set above

// Titles on top
const titleWrapper = svg.append("g").attr("class", "chordTitleWrapper");
const titleOffset = mobileScreen ? 15 : 40;
const titleSeparate = mobileScreen ? 30 : 0;

// Title top left
titleWrapper.append("text")
    .attr("class", "title left")
    .style("font-size", mobileScreen ? "12px" : "16px")
    .attr("x", (width/2 + margin.left - outerRadius - titleSeparate))
    .attr("y", titleOffset)
    .text("Left side");

titleWrapper.append("line")
    .attr("class", "titleLine left")
    .attr("x1", (width/2 + margin.left - outerRadius - titleSeparate)*0.6)
    .attr("x2", (width/2 + margin.left - outerRadius - titleSeparate)*1.4)
    .attr("y1", titleOffset+8)
    .attr("y2", titleOffset+8);

// Title top right
titleWrapper.append("text")
    .attr("class", "title right")
    .style("font-size", mobileScreen ? "12px" : "16px")
    .attr("x", (width/2 + margin.left + outerRadius + titleSeparate))
    .attr("y", titleOffset)
    .text("Right side");

titleWrapper.append("line")
    .attr("class", "titleLine right")
    .attr("x1", (width/2 + margin.left - outerRadius - titleSeparate)*0.6 + 2*(outerRadius + titleSeparate))
    .attr("x2", (width/2 + margin.left - outerRadius - titleSeparate)*1.4 + 2*(outerRadius + titleSeparate))
    .attr("y1", titleOffset+8)
    .attr("y2", titleOffset+8);

// Data definition
const Names = ["Domein HR","Logistiek en Financien","Domein ICTS","Servicepunt","Domein Onderzoek","Fac. Inter/intranet","Ondersteuning Lokale Infrastructuur","Other", "",
    "Other.in","Domein Onderwijs.in","Domein Onderzoek.in","Servicepunt.in","Domein ICTS.in","Logistiek en Financien.in","Domein HR.in",""];

const respondents = 4443; // Total number of respondents
const emptyPerc = 0.5; // What % of the circle should become empty
const emptyStroke = Math.round(respondents * emptyPerc);

// Matrix data
const matrix = [
[0, 0,0,0,0,0,0,0, 0, 7,  3,  9,  0,  274,    3,  1478,   0], //  Domein HR
[0, 0,0,0,0,0,0,0, 0, 17, 2,  17, 0,  804,    1211,   14, 0], //  Logistiek en Financien
[0, 0,0,0,0,0,0,0, 0, 31, 0,  0,  90, 334,    13, 7,  0], //  Domein ICTS
[0, 0,0,0,0,0,0,0, 0, 0,  0,  0,  0,  2,  0,  45, 0], //  Servicepunt
[0, 0,0,0,0,0,0,0, 0, 0,  0,  0,  0,  1,  27, 3,  0], //  Domein Onderzoek
[0, 0,0,0,0,0,0,0, 0, 0,  0,  0,  0,  0,  0,  11, 0], //  Fac. Inter/intranet
[0, 0,0,0,0,0,0,0, 0, 0,  0,  0,  0,  0,  7,  2,  0], //  Ondersteuning Lokale Infrastructuur
[0, 0,0,0,0,0,0,0, 0, 0,  0,  0,  0,  3,  13, 16, 0], //  Other
[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,emptyStroke], // dummyBottom
[7, 17, 31, 0,  0,  0,  0,  0,  0,  0,0,0,0,0,0,0, 0], // Other.in
[3, 2,  0,  0,  0,  0,  0,  0,  0,  0,0,0,0,0,0,0, 0], // Domein Onderwijs.in
[9, 17, 0,  0,  0,  0,  0,  0,  0,  0,0,0,0,0,0,0, 0], // Domein Onderzoek.in
[0, 0,  90, 0,  0,  0,  0,  0,  0,  0,0,0,0,0,0,0, 0], // Servicepunt.in
[274,    804,    334,    2,  1,  0,  0,  3,  0,  0,0,0,0,0,0,0, 0], // Domein ICTS.in
[3, 1211,   13, 0,  27, 0,  7,  13, 0,  0,0,0,0,0,0,0, 0], // Logistiek en Financien.in
[1478,   14, 7,  45, 3,  11, 2,  16, 0,  0,0,0,0,0,0,0, 0], // Domein HR.in
[0,0,0,0,0,0,0,0,emptyStroke,0,0,0,0,0,0,0,0] // dummyTop
];

// Calculate how far the Chord Diagram needs to be rotated clockwise
const offset = (2 * Math.PI) * (emptyStroke/(respondents + emptyStroke))/4;

// Create custom chord layout
const chord = customChordLayout()
    .padding(.02)
    .sortChords(d3.descending) // chord display order
    .matrix(matrix);

// Create arc generator
const arc = d3.arc()
    .innerRadius(innerRadius)
    .outerRadius(outerRadius)
    .startAngle(d => d.startAngle + offset) // Include the offset
    .endAngle(d => d.endAngle + offset);    // Include the offset

// Create stretched chord path generator
const path = stretchedChord()
    .radius(innerRadius)
    .startAngle(d => d.startAngle + offset)
    .endAngle(d => d.endAngle + offset);

// Draw outer Arcs
const g = wrapper.selectAll("g.group")
    .data(chord.groups())
    .join("g")
    .attr("class", "group")
    .on("mouseover", function(event, d) {
        fade(opacityLow)(d);
        showTooltip(event, d, d.index);
    })
    .on("mouseout", function(event, d) {
        fade(opacityDefault)(d);
        hideTooltip();
    });

// Create a color scale
const colors = d3.schemeCategory10; // D3's built-in color scheme

// Modify the arc path fill and stroke properties
g.append("path")
    .style("stroke", (d, i) => (Names[i] === "" ? "none" : colors[i % colors.length]))
    .style("fill", (d, i) => (Names[i] === "" ? "none" : colors[i % colors.length]))
    .style("opacity", 0.7) // Keep semi-transparency
    .style("pointer-events", (d, i) => (Names[i] === "" ? "none" : "auto"))
    .attr("d", arc)
    .attr("transform", function(d) {
        // Pull the two slices apart
        d.pullOutSize = pullOutSize * (d.startAngle + 0.001 > Math.PI ? -1 : 1);
        return `translate(${d.pullOutSize},0)`;
    });

// Create dynamic gradients for each chord
const defs = svg.append("defs");

// Create a gradient for each chord
chord.chords().forEach((d, i) => {
    if (Names[d.source.index] === "") return;
    
    // sourceColor on left side, targetColor on right side
    const sourceColor = colors[d.source.index % colors.length];
    const targetColor = colors[d.target.index % colors.length];
     
    // Create the gradient for this chord
    const gradient = defs.append("linearGradient")
        .attr("id", `gradient-${i}`)
        .attr("gradientUnits", "userSpaceOnUse");
    
    // For better positioning, set the gradient vectors to follow the chord path
    // Start position - will be near the target arc
    gradient.attr("x1", "100%")
           .attr("y1", "0%")
           // End position - will be near the source arc
           .attr("x2", "0%")
           .attr("y2", "0%");
    
    // Add more stops for better color blending and matching with arcs
    gradient.append("stop")
        .attr("offset", "0%")
        .attr("stop-color", sourceColor)
        .attr("stop-opacity", 0.7);
    
    // Add middle blend point if desired
    gradient.append("stop")
        .attr("offset", "50%")
        .attr("stop-color", d3.interpolateRgb(sourceColor, targetColor)(0.5))
        .attr("stop-opacity", 0.7);
    
    gradient.append("stop")
        .attr("offset", "100%")
        .attr("stop-color", targetColor)
        .attr("stop-opacity", 0.7);
});

// Update the chord paths to use the individual gradients
wrapper.selectAll("path.chord")
    .data(chord.chords())
    .join("path")
    .attr("class", "chord")
    .style("stroke", "none")
    .style("fill", (d, i) => Names[d.source.index] === "" ? "none" : `url(#gradient-${i})`)
    .style("opacity", d => (Names[d.source.index] === "" ? 0 : opacityDefault))
    .style("pointer-events", (d, i) => (Names[d.source.index] === "" ? "none" : "auto"))
    .attr("d", path)
    .on("mouseover", function(event, d) {
        fadeOnChord(event, d);
        showChordTooltip(event, d);
    })
    .on("mouseout", function(event, d) {
        fade(opacityDefault)(d);
        hideTooltip();
    });

// Helper function for angle calculations
function startAngle(d) { return d.startAngle + offset; }
function endAngle(d) { return d.endAngle + offset; }

// Append Names to arcs
g.append("text")
    .each(function(d) { 
        d.angle = ((d.startAngle + d.endAngle) / 2) + offset;
    })
    .attr("dy", ".35em")
    .attr("class", "titles")
    .style("font-size", mobileScreen ? "8px" : "10px")
    .attr("text-anchor", function(d) { 
        return d.angle > Math.PI ? "end" : null; 
    })
    .attr("transform", function(d, i) { 
        const c = arc.centroid(d);
        return `translate(${c[0] + d.pullOutSize},${c[1]})` +
               `rotate(${(d.angle * 180 / Math.PI - 90)})` +
               `translate(20,0)` +
               (d.angle > Math.PI ? "rotate(180)" : "");
    })
    .text((d, i) => Names[i])
    .call(wrapChord, 100);

// Draw inner chords
wrapper.selectAll("path.chord")
    .data(chord.chords())
    .join("path")
    .attr("class", "chord")
    .style("stroke", "none")
    //.style("fill", "url(#gradientLinearPerLine)") // SVG Gradient
    .style("opacity", d => (Names[d.source.index] === "" ? 0 : opacityDefault))
    .style("pointer-events", (d, i) => (Names[d.source.index] === "" ? "none" : "auto"))
    .attr("d", path)
    .on("mouseover", fadeOnChord)
    .on("mouseout", (event, d) => fade(opacityDefault)(d));

// Returns an event handler for fading a given chord group
function fade(opacity) {
    return function(d) {
        wrapper.selectAll("path.chord")
            .filter(function(d2) { 
                return d2.source.index != d.index && 
                       d2.target.index != d.index && 
                       Names[d2.source.index] != ""; 
            })
            .transition()
            .style("opacity", opacity);
    };
}

// Fade function when hovering over chord
function fadeOnChord(event, d) {
    const chosen = d;
    wrapper.selectAll("path.chord")
        .transition()
        .style("opacity", function(d) {
            if (d.source.index == chosen.source.index && d.target.index == chosen.target.index) {
                return opacityDefault;
            } else { 
                return opacityLow; 
            }
        });
}

// Wraps SVG text
function wrapChord(text, width) {
    text.each(function() {
        const text = d3.select(this);
        const words = text.text().split(/\s+/).reverse();
        let word;
        let line = [];
        let lineNumber = 0;
        const lineHeight = 1.1; // ems
        const y = 0;
        const x = 0;
        const dy = parseFloat(text.attr("dy"));
        let tspan = text.text(null).append("tspan").attr("x", x).attr("y", y).attr("dy", dy + "em");

        while (word = words.pop()) {
            line.push(word);
            tspan.text(line.join(" "));
            if (tspan.node().getComputedTextLength() > width) {
                line.pop();
                tspan.text(line.join(" "));
                line = [word];
                tspan = text.append("tspan")
                    .attr("x", x)
                    .attr("y", y)
                    .attr("dy", ++lineNumber * lineHeight + dy + "em")
                    .text(word);
            }
        }
    });
}

} // End ENABLE_CHART1 conditional

// Shared tooltip functions needed by both charts
function showTooltip(event, d, index) {
    const tooltip = document.getElementById('chord-tooltip');
    if (tooltip) {
        const name = Names[index] || `Item ${index}`;
        tooltip.innerHTML = `<strong>${name}</strong><br>Index: ${index}<br>Value: ${d.value || 'N/A'}`;
        tooltip.style.opacity = 1;
        tooltip.style.left = (event.pageX + 10) + 'px';
        tooltip.style.top = (event.pageY - 10) + 'px';
    }
}

function showChordTooltip(event, d) {
    const tooltip = document.getElementById('chord-tooltip');
    if (tooltip) {
        const sourceName = Names[d.source.index] || `Source ${d.source.index}`;
        const targetName = Names[d.target.index] || `Target ${d.target.index}`;
        tooltip.innerHTML = `<strong>Connection</strong><br>From: ${sourceName}<br>To: ${targetName}<br>Value: ${d.source.value.toFixed(3)}`;
        tooltip.style.opacity = 1;
        tooltip.style.left = (event.pageX + 10) + 'px';
        tooltip.style.top = (event.pageY - 10) + 'px';
    }
}

function hideTooltip() {
    const tooltip = document.getElementById('chord-tooltip');
    if (tooltip) {
        tooltip.style.opacity = 0;
    }
}

// ChordDiagram class definition
class ChordDiagram {
    constructor(containerId, data = sampleData, options = {}) {
        this.containerId = containerId;
        this.data = data;
        this.options = {...config, ...options};
        this.init();
    }

    updateDimensions() {
        // Get container dimensions for responsiveness
        const container = document.querySelector(this.containerId);
        const containerWidth = container ? container.clientWidth : window.innerWidth;
        
        this.mobileScreen = containerWidth <= 500;
        this.useCompactLabels = containerWidth < 600;
        
        // Adjust margins based on label type
        const labelMargin = this.useCompactLabels ? 0 : 60; // Remove margins when using compact labels
        const adjustedMargins = {
            left: labelMargin,
            top: this.options.margin.top,
            right: labelMargin,
            bottom: this.options.margin.bottom
        };
        
        // Use full container width minus adjusted margins
        this.width = containerWidth - adjustedMargins.left - adjustedMargins.right;
        this.height = (this.mobileScreen ? 300 : this.width * 0.8) - 
                     adjustedMargins.top - adjustedMargins.bottom;
        
        // Ensure minimum dimensions
        this.width = Math.max(this.width, 300);
        this.height = Math.max(this.height, 250);
        
        // Store adjusted margins for use in setupSVG
        this.adjustedMargins = adjustedMargins;
    }

    redraw() {
        // Clear and recreate the chart with new dimensions
        d3.select(this.containerId).select("svg").remove();

        // Process data first to know label positions
        this.processData();

        // Recalculate top margin for labels
        this.topLabelMargin = this.calculateTopLabelSpace();
        if (this.adjustedMargins) {
            this.adjustedMargins.top = Math.max(this.options.margin.top, this.topLabelMargin);
        }

        this.setupSVG();
        this.createGradients();
        this.render();
    }

    init() {
        // Setup responsive dimensions
        this.updateDimensions();

        // Add resize listener for responsiveness
        window.addEventListener('resize', () => {
            this.updateDimensions();
            this.redraw();
        });

        // pullOutSize is now set in setupSVG based on label mode

        // Add offset for separated chord layout like chart1
        const totalNodes = this.data.nodes.length;
        const emptyPerc = 0.5; // What % of the circle should become empty
        const emptyStroke = Math.round(totalNodes * emptyPerc);
        this.offset = (2 * Math.PI) * (emptyStroke/(totalNodes + emptyStroke))/4;

        // Process data first to know label positions
        this.processData();

        // Calculate additional top margin needed for labels at top of chart
        this.topLabelMargin = this.calculateTopLabelSpace();

        // Adjust top margin based on label space needed
        if (this.adjustedMargins) {
            this.adjustedMargins.top = Math.max(this.adjustedMargins.top, this.topLabelMargin);
        }

        this.setupSVG();
        this.createGradients();
        this.render();
    }

    calculateTopLabelSpace() {
        // Simple approach: find how close the topmost label is to pointing straight up
        if (!this.chordLayout || !this.orderedNodes || this.useCompactLabels) {
            return this.options.margin.top;
        }

        // Get container width to match font-size breakpoints used in renderFullLabels
        const container = document.querySelector(this.containerId);
        const containerWidth = container ? container.clientWidth : window.innerWidth;

        // Match the font-size logic from renderFullLabels (lines 1330, 1376, 1425)
        let pxPerChar;
        if (containerWidth > 1400) {
            pxPerChar = 8; // 14px font
        } else if (containerWidth > 800) {
            pxPerChar = 7; // 12px font
        } else {
            pxPerChar = 6; // 10px font
        }

        const groups = this.chordLayout.groups();

        // "Straight up" in SVG with our offset applied is around 3π/2
        const upAngle = 3 * Math.PI / 2;

        let closestToUp = Infinity;
        let closestLabelLength = 0;

        groups.forEach((group) => {
            const angle = ((group.startAngle + group.endAngle) / 2) + this.offset;
            const normalizedAngle = ((angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);

            // Angular distance from straight up
            let distFromUp = Math.abs(normalizedAngle - upAngle);
            if (distFromUp > Math.PI) distFromUp = 2 * Math.PI - distFromUp;

            if (this.orderedNodes[group.index]) {
                const node = this.orderedNodes[group.index];
                const labelText = node.name || node.id || '';
                const displayText = labelText.length > 32 ? labelText.substring(0, 29) + '...' : labelText;

                // Track the label closest to pointing up
                if (distFromUp < closestToUp) {
                    closestToUp = distFromUp;
                    closestLabelLength = displayText.length;
                }
            }
        });

        // If closest label is far from vertical (> ~60°), labels are spread out
        if (closestToUp > 1.05) { // ~60 degrees
            console.log(`Top label calc: spread out (dist=${(closestToUp * 180 / Math.PI).toFixed(0)}°), margin=10, width=${containerWidth}`);
            return 10;
        }

        // Scale: closestToUp=0 → most upright, closestToUp=1.05 → spread out
        // uprightness: 1 = pointing straight up, 0 = 60° away
        const uprightness = Math.max(0, 1 - (closestToUp / 1.05));

        // Extra margin scales with uprightness and font size
        // Base extra is 80px at smallest font, scale up for larger fonts
        const fontScale = pxPerChar / 6; // 1.0 for small, ~1.17 for medium, ~1.33 for large
        const extraMargin = uprightness * 80 * fontScale;
        const requiredMargin = 10 + extraMargin;

        console.log(`Top label calc: uprightness=${(uprightness * 100).toFixed(0)}%, dist=${(closestToUp * 180 / Math.PI).toFixed(0)}°, margin=${requiredMargin.toFixed(0)}, width=${containerWidth}, pxPerChar=${pxPerChar}`);

        return requiredMargin;
    }

    setupSVG() {
        // Use adjusted margins if available, otherwise use default
        const margins = this.adjustedMargins || this.options.margin;

        // Create main SVG with overflow visible to prevent label clipping
        this.svg = d3.select(this.containerId).append("svg")
            .attr("width", this.width + margins.left + margins.right)
            .attr("height", this.height + margins.top + margins.bottom)
            .style("overflow", "visible");

        // Create wrapper group
        this.wrapper = this.svg.append("g")
            .attr("class", "chordWrapper")
            .attr("transform", `translate(${this.width/2 + margins.left},
                                       ${this.height/2 + margins.top})`);

        // Setup dimensions with expanded radius for compact labels
        const mobileScreen = this.width <= 500;
        
        // For compact labels, maximize the chart size since we have no text extending outward
        const radiusReduction = this.useCompactLabels ? 
            (mobileScreen ? 25 : 30) :  // Minimal reduction for compact labels
            (mobileScreen ? 80 : 100);  // More reduction for full labels
        
        this.outerRadius = Math.min(this.width, this.height) / 2 - radiusReduction;
        this.innerRadius = this.outerRadius * 0.95;
        
        // Update pullOutSize based on current dimensions and label mode
        this.pullOutSize = this.useCompactLabels ? 
            (mobileScreen ? 15 : 20) :  // Smaller pullout for compact labels
            (mobileScreen ? 20 : 50);   // Standard pullout for full labels
    }

    processData() {
        // Convert JSON data to matrix format
        this.matrix = this.createMatrix(this.data);
        
        // Get sector count for separated layout
        const sectors = this.data.nodes.filter(node => node.type === 'sector');
        const indicators = this.data.nodes.filter(node => node.type === 'indicator');
        
        // Create chord layout with separation info
        // Since we reordered to [indicators, sectors], pass the number of sectors for proper positioning
        this.chordLayout = customChordLayout()
            .padding(.02)
            .sortChords(d3.descending)
            .numSectors(sectors.length)  // Pass actual number of sectors (even though indicators come first in matrix)
            .matrix(this.matrix);
    }

    createMatrix(data) {
        // Create matrix from nodes and links for separated chord layout
        const sectors = data.nodes.filter(node => node.type === 'sector');
        const indicators = data.nodes.filter(node => node.type === 'indicator');
        
        // For separated chord: place indicators on right side (0 to π), sectors on left side (π to 2π)
        // This means we need indicators first (positions 0 to numIndicators-1), then sectors
        const orderedNodes = [...indicators, ...sectors];
        const numSectors = sectors.length;
        const numIndicators = indicators.length;
        const totalNodes = orderedNodes.length;
        
        console.log(`Separated chord layout: ${numIndicators} indicators (right side), ${numSectors} sectors (left side)`);
        
        const matrix = Array(totalNodes).fill().map(() => Array(totalNodes).fill(0));
        
        // Fill in the matrix using the reordered nodes
        // Since we reordered to [indicators, sectors], we need to adjust the links
        data.links.forEach(link => {
            const sourceIndex = orderedNodes.findIndex(node => node.id === link.source);
            const targetIndex = orderedNodes.findIndex(node => node.id === link.target);
            
            if (sourceIndex !== -1 && targetIndex !== -1) {
                matrix[sourceIndex][targetIndex] = link.value;
                // Store original value for tooltips
                if (!matrix.originalValues) matrix.originalValues = {};
                matrix.originalValues[`${sourceIndex}-${targetIndex}`] = link.originalValue || link.value;
            }
        });
        
        // Store ordered nodes for consistent labeling and tooltips
        this.orderedNodes = orderedNodes;
        
        // Debug: show matrix structure
        const rowSums = matrix.map(row => row.reduce((sum, val) => sum + val, 0));
        const colSums = Array(totalNodes).fill(0);
        for (let i = 0; i < totalNodes; i++) {
            for (let j = 0; j < totalNodes; j++) {
                colSums[j] += matrix[i][j];
            }
        }
        
        console.log(`Matrix structure:`);
        console.log(`Row sums:`, rowSums.map(sum => sum.toFixed(2)));
        console.log(`Col sums:`, colSums.map(sum => sum.toFixed(2)));
        console.log(`Ordered nodes:`, orderedNodes.map((n, i) => `${i}: ${n.name || n.id} (${n.type})`));
        
        return matrix;
    }

    createGradients() {
        // Create defs for gradients
        const defs = this.svg.append("defs");
        
        // Define consistent color scheme for nodes (darker, no duplicate yellows)
        this.nodeColors = [
            "#E74C3C", "#16A085", "#2980B9", "#27AE60", "#F39C12",
            "#8E44AD", "#34495E", "#E67E22", "#9B59B6", "#3498DB",
            "#1565C0", "#2ECC71", "#E91E63", "#795548", "#607D8B",
            "#FF5722", "#009688", "#673AB7", "#FF9800", "#4CAF50"
        ];
    }

    createChordGradients() {
        if (!this.svg.select("defs").node()) {
            this.svg.append("defs");
        }
        const defs = this.svg.select("defs");
        
        // Create gradients for each chord based on connected node colors
        this.chordLayout.chords().forEach((d, i) => {
            // Get colors for source and target nodes
            const sourceColor = this.nodeColors[d.source.index % this.nodeColors.length];
            const targetColor = this.nodeColors[d.target.index % this.nodeColors.length];
            
            // Create lighter versions for the gradient
            const sourceLightColor = d3.color(sourceColor).brighter(0.4);
            const targetLightColor = d3.color(targetColor).brighter(0.4);
            
            const gradient = defs.append("linearGradient")
                .attr("id", `chord-gradient-${i}`)
                .attr("gradientUnits", "userSpaceOnUse")
                .attr("x1", "0%")
                .attr("y1", "0%")
                .attr("x2", "100%")
                .attr("y2", "0%");
                
            // Start with source node color
            gradient.append("stop")
                .attr("offset", "0%")
                .attr("stop-color", sourceColor)
                .attr("stop-opacity", 0.8);
                
            // Blend in the middle with lighter colors
            gradient.append("stop")
                .attr("offset", "25%")
                .attr("stop-color", sourceLightColor)
                .attr("stop-opacity", 0.7);
                
            gradient.append("stop")
                .attr("offset", "75%")
                .attr("stop-color", targetLightColor)
                .attr("stop-opacity", 0.7);
                
            // End with target node color
            gradient.append("stop")
                .attr("offset", "100%")
                .attr("stop-color", targetColor)
                .attr("stop-opacity", 0.8);
        });
    }

    render() {
        // Render titles
        this.renderTitles();
        // Render arcs
        this.renderArcs();
        // Render chords
        this.renderChords();
        // Render labels
        this.renderLabels();
    }

    renderArcs() {
        // Draw outer Arcs
        const g = this.wrapper.selectAll("g.group")
            .data(this.chordLayout.groups())
            .join("g")
            .attr("class", "group")
            .on("mouseover", (event, d) => {
                this.fade(this.options.opacity.low)(d);
                this.showTooltip(event, d, d.index);
            })
            .on("mouseout", (event, d) => {
                this.fade(this.options.opacity.default)(d);
                this.hideTooltip();
            });

        // Create a color scale
        const colors = d3.schemeCategory10;

        // Create arc generator with offset for separation
        const arc = d3.arc()
            .innerRadius(this.innerRadius)
            .outerRadius(this.outerRadius)
            .startAngle(d => d.startAngle + this.offset)
            .endAngle(d => d.endAngle + this.offset);

        // Add arc paths
        g.append("path")
            .style("stroke", (d, i) => this.nodeColors[d.index % this.nodeColors.length])
            .style("fill", (d, i) => this.nodeColors[d.index % this.nodeColors.length])
            .style("opacity", this.options.opacity.default)
            .attr("d", arc)
            .attr("transform", (d) => {
                // Pull the two slices apart (add offset for proper calculation)
                d.pullOutSize = this.pullOutSize * ((d.startAngle + this.offset + 0.001) > Math.PI ? -1 : 1);
                return `translate(${d.pullOutSize},0)`;
            });
    }

    renderChords() {
        // Create gradients for chords first
        this.createChordGradients();
        
        // Create stretched chord path generator with offset
        const path = stretchedChord()
            .radius(this.innerRadius)
            .startAngle(d => d.startAngle + this.offset)
            .endAngle(d => d.endAngle + this.offset)
            .pullOutSize(this.pullOutSize); // Use instance pullOutSize

        // Draw chords
        const chords = this.chordLayout.chords();
        console.log(`Rendering ${chords.length} chords`);
        
        this.wrapper.selectAll("path.chord")
            .data(chords)
            .join("path")
            .attr("class", "chord")
            .style("stroke", (d, i) => {
                const borderStyle = this.options.chordBorder.style;
                if (borderStyle === "none") {
                    return "none";
                }
                
                const sourceColor = this.nodeColors[d.source.index % this.nodeColors.length];
                const targetColor = this.nodeColors[d.target.index % this.nodeColors.length];
                
                if (borderStyle === "dark") {
                    // Use the darker source node color
                    return sourceColor;
                } else if (borderStyle === "light") {
                    // Use extremely light version that matches the connection gradient
                    const sourceLightColor = d3.color(sourceColor).brighter(1.5);
                    const targetLightColor = d3.color(targetColor).brighter(1.5);
                    // Blend the two extremely light colors
                    const blended = d3.interpolate(sourceLightColor, targetLightColor)(0.5);
                    return blended;
                }
                
                return "none"; // fallback
            })
            .style("stroke-width", (d, i) => {
                return this.options.chordBorder.style === "none" ? "0" : this.options.chordBorder.width;
            })
            .style("fill", (d, i) => `url(#chord-gradient-${i})`)
            .style("opacity", this.options.opacity.default)
            .style("pointer-events", "all") // Ensure entire chord area is hoverable
            .attr("d", (d, i) => {
                const pathData = path(d);
                return pathData;
            })
            .on("mouseover", (event, d) => {
                d3.select(event.target).style("opacity", 0.9); // Highlight on hover
                this.showChordTooltip(event, d);
            })
            .on("mouseout", (event, d) => {
                d3.select(event.target).style("opacity", this.options.opacity.default);
                this.hideTooltip();
            });
    }

    renderLabels() {
        // Use the stored useCompactLabels property set in updateDimensions
        if (this.useCompactLabels) {
            this.renderCompactLabels();
        } else {
            this.renderFullLabels();
        }
    }

    renderCompactLabels() {
        // Create arc generator for positioning
        const arc = d3.arc()
            .innerRadius(this.innerRadius)
            .outerRadius(this.outerRadius)
            .startAngle(d => d.startAngle + this.offset)
            .endAngle(d => d.endAngle + this.offset);

        // Remove existing labels
        this.wrapper.selectAll("g.group").selectAll("text").remove();
        this.wrapper.selectAll("g.group").selectAll("circle").remove();

        // Add circles with numbers/letters
        this.wrapper.selectAll("g.group")
            .each((d, i) => {
                const group = d3.select(this.wrapper.selectAll("g.group").nodes()[i]);
                d.angle = ((d.startAngle + d.endAngle) / 2) + this.offset;
                
                const c = arc.centroid(d);
                const node = this.orderedNodes[d.index];
                const isIndicator = node && node.type === 'indicator';
                
                // Determine label and colors
                let label, circleColor, textColor;
                if (isIndicator) {
                    // Letters for indicators (A, B, C, etc.) on dark rust circles
                    const indicatorIndex = d.index; // Since indicators come first in orderedNodes
                    label = String.fromCharCode(65 + indicatorIndex); // A, B, C...
                    circleColor = "#B7472A"; // Darker rust color
                    textColor = "white";
                } else {
                    // Numbers for sectors (inverted order: 10, 9, 8, etc.) on charcoal circles
                    const totalSectors = this.orderedNodes.filter(n => n.type === 'sector').length;
                    const sectorIndex = d.index - this.orderedNodes.filter(n => n.type === 'indicator').length;
                    label = (totalSectors - sectorIndex).toString(); // Inverted order
                    circleColor = "#36454F"; // Charcoal color
                    textColor = "white";
                }

                // Calculate position to avoid overlaps
                const baseDistance = 20;
                const circleRadius = 9; // Smaller circles
                let posX = c[0] + d.pullOutSize;
                let posY = c[1];
                
                // Check for nearby labels and adjust position
                const nearbyGroups = this.wrapper.selectAll("g.group").nodes();
                for (let j = 0; j < i; j++) {
                    const otherGroup = d3.select(nearbyGroups[j]);
                    const otherCircle = otherGroup.select("circle");
                    if (!otherCircle.empty()) {
                        const otherX = parseFloat(otherCircle.attr("cx"));
                        const otherY = parseFloat(otherCircle.attr("cy"));
                        const distance = Math.sqrt((posX - otherX)**2 + (posY - otherY)**2);
                        
                        if (distance < circleRadius * 2.2) { // Reduced offset multiplier
                            // Adjust position to avoid overlap with smaller offset
                            const angle = Math.atan2(posY - otherY, posX - otherX);
                            posX = otherX + Math.cos(angle) * circleRadius * 2.2;
                            posY = otherY + Math.sin(angle) * circleRadius * 2.2;
                        }
                    }
                }

                // Add circle
                group.append("circle")
                    .attr("cx", posX)
                    .attr("cy", posY)
                    .attr("r", circleRadius)
                    .style("fill", circleColor)
                    .style("stroke", "white")
                    .style("stroke-width", "2px");

                // Get container width for responsive compact label sizing
                const container = document.querySelector(this.containerId);
                const containerWidth = container ? container.clientWidth : window.innerWidth;
                
                // Determine compact label font size based on container width
                let compactFontSize;
                if (containerWidth > 1400) {
                    compactFontSize = "10px"; // Larger compact labels for wide screens
                } else if (containerWidth > 800) {
                    compactFontSize = "9px";  // Medium compact labels
                } else {
                    compactFontSize = "8px";  // Default compact size
                }

                // Add text
                group.append("text")
                    .attr("x", posX)
                    .attr("y", posY)
                    .attr("dy", ".35em")
                    .attr("text-anchor", "middle")
                    .style("fill", textColor)
                    .style("font-size", compactFontSize)
                    .style("font-weight", "bold")
                    .text(label);
            });
    }

    renderFullLabels() {
        // Create arc generator for label positioning with offset
        const arc = d3.arc()
            .innerRadius(this.innerRadius)
            .outerRadius(this.outerRadius)
            .startAngle(d => d.startAngle + this.offset)
            .endAngle(d => d.endAngle + this.offset);

        // Remove existing circles
        this.wrapper.selectAll("g.group").selectAll("circle").remove();

        // Add labels to arcs
        this.wrapper.selectAll("g.group")
            .selectAll("text")
            .data(d => [d])
            .join("text")
            .each(function(d) { 
                d.angle = ((d.startAngle + d.endAngle) / 2) + this.offset;
            }.bind(this))
            .attr("dy", ".35em")
            .attr("class", "titles")
            .style("font-size", () => {
                const container = document.querySelector(this.containerId);
                const containerWidth = container ? container.clientWidth : window.innerWidth;
                
                if (containerWidth > 1400) {
                    return "14px"; // Larger labels for wide screens
                } else if (containerWidth > 800) {
                    return "12px"; // Medium labels for medium screens
                } else {
                    return "10px"; // Default size for smaller screens
                }
            })
            .attr("text-anchor", function(d) { 
                return d.angle > Math.PI ? "end" : null; 
            })
            .attr("transform", function(d) { 
                const c = arc.centroid(d);
                // Adjust label distance based on side to prevent cropping
                const labelDistance = d.angle > Math.PI ? 15 : 15; // Reduce distance to keep labels in view
                return `translate(${c[0] + d.pullOutSize},${c[1]})` +
                       `rotate(${(d.angle * 180 / Math.PI - 90)})` +
                       `translate(${labelDistance},0)` +
                       (d.angle > Math.PI ? "rotate(180)" : "");
            })
            .text((d, i) => {
                // Get the node name from the ordered nodes data using d.index (which is the correct mapping)
                let labelText = '';
                if (this.orderedNodes && this.orderedNodes[d.index]) {
                    labelText = this.orderedNodes[d.index].name || this.orderedNodes[d.index].id;
                } else if (this.orderedNodes && this.orderedNodes[i]) {
                    labelText = this.orderedNodes[i].name || this.orderedNodes[i].id;
                } else {
                    labelText = `Label ${i}`;
                }
                
                // Limit to 32 characters
                return labelText.length > 32 ? labelText.substring(0, 29) + '...' : labelText;
            });
    }

    renderTitles() {
        // Titles on top
        const titleWrapper = this.svg.append("g").attr("class", "chordTitleWrapper");
        const mobileScreen = this.width <= 500;
        const titleOffset = mobileScreen ? 15 : 40;
        const titleSeparate = mobileScreen ? 30 : 0;

        // Get container width for responsive title sizing
        const container = document.querySelector(this.containerId);
        const containerWidth = container ? container.clientWidth : window.innerWidth;
        
        // Determine title font size based on container width
        let titleFontSize;
        if (containerWidth > 1400) {
            titleFontSize = "20px"; // Larger titles for wide screens
        } else if (containerWidth > 800) {
            titleFontSize = "18px"; // Medium titles for medium screens
        } else if (mobileScreen) {
            titleFontSize = "12px"; // Small titles for mobile
        } else {
            titleFontSize = "16px"; // Default size
        }

        // Title top left
        titleWrapper.append("text")
            .attr("class", "title left")
            .style("font-size", titleFontSize)
            .attr("x", (this.width/2 + this.options.margin.left - this.outerRadius - titleSeparate))
            .attr("y", titleOffset)
            .text(this.options.titles.left || "Left side");

        titleWrapper.append("line")
            .attr("class", "titleLine left")
            .attr("x1", (this.width/2 + this.options.margin.left - this.outerRadius - titleSeparate)*0.6)
            .attr("x2", (this.width/2 + this.options.margin.left - this.outerRadius - titleSeparate)*1.4)
            .attr("y1", titleOffset+8)
            .attr("y2", titleOffset+8);

        // Title top right
        titleWrapper.append("text")
            .attr("class", "title right")
            .style("font-size", titleFontSize)
            .attr("x", (this.width/2 + this.options.margin.left + this.outerRadius + titleSeparate))
            .attr("y", titleOffset)
            .text(this.options.titles.right || "Right side");

        titleWrapper.append("line")
            .attr("class", "titleLine right")
            .attr("x1", (this.width/2 + this.options.margin.left - this.outerRadius - titleSeparate)*0.6 + 2*(this.outerRadius + titleSeparate))
            .attr("x2", (this.width/2 + this.options.margin.left - this.outerRadius - titleSeparate)*1.4 + 2*(this.outerRadius + titleSeparate))
            .attr("y1", titleOffset+8)
            .attr("y2", titleOffset+8);
    }

    fade(opacity) {
        return (d) => {
            this.wrapper.selectAll("path.chord")
                .filter(function(d2) { 
                    return d2.source.index != d.index && d2.target.index != d.index; 
                })
                .transition()
                .style("opacity", opacity);
        };
    }

    fadeOnChord(event, d) {
        const chosen = d;
        const opacityDefault = this.options.opacity.default;
        const opacityLow = this.options.opacity.low;
        this.wrapper.selectAll("path.chord")
            .transition()
            .style("opacity", function(d) {
                if (d.source.index == chosen.source.index && d.target.index == chosen.target.index) {
                    return opacityDefault;
                } else { 
                    return opacityLow; 
                }
            });
    }

    showTooltip(event, d, index) {
        const tooltip = document.getElementById('chord-tooltip');
        if (tooltip && this.orderedNodes && this.orderedNodes[index]) {
            const node = this.orderedNodes[index];
            const name = node.name || node.id;
            const type = node.type || 'Unknown';
            const metadata = node.metadata || {};
            
            let tooltipContent = `<strong>${name}</strong><br>Type: ${type}`;
            
            // Add metadata information
            if (metadata.NAICS) {
                tooltipContent += `<br>NAICS: ${metadata.NAICS}`;
            }
            if (metadata.code && metadata.code !== metadata.NAICS) {
                tooltipContent += `<br>Code: ${metadata.code}`;
            }
            if (metadata.unit) {
                tooltipContent += `<br>Unit: ${metadata.unit}`;
            }
            if (metadata.location && metadata.location !== 'N/A') {
                tooltipContent += `<br>Location: ${metadata.location}`;
            }
            if (metadata.category) {
                tooltipContent += `<br>Category: ${metadata.category}`;
            }
            
            tooltipContent += `<br>Value: ${d.value || 'N/A'}`;
            
            tooltip.innerHTML = tooltipContent;
            tooltip.style.opacity = 1;
            tooltip.style.left = (event.pageX + 10) + 'px';
            tooltip.style.top = (event.pageY - 10) + 'px';
        }
    }

    showChordTooltip(event, d) {
        const tooltip = document.getElementById('chord-tooltip');
        if (tooltip && this.orderedNodes) {
            const sourceNode = this.orderedNodes[d.source.index];
            const targetNode = this.orderedNodes[d.target.index];
            const sourceName = sourceNode ? (sourceNode.name || sourceNode.id) : `Source ${d.source.index}`;
            const targetName = targetNode ? (targetNode.name || targetNode.id) : `Target ${d.target.index}`;
            
            // Get metadata for additional info
            const sourceMetadata = sourceNode ? sourceNode.metadata || {} : {};
            const targetMetadata = targetNode ? targetNode.metadata || {} : {};
            
            // Get original value if stored in matrix
            const originalKey = `${d.source.index}-${d.target.index}`;
            const originalValue = this.matrix.originalValues && this.matrix.originalValues[originalKey];
            
            let tooltipContent = `<strong>Connection</strong><br>From: ${sourceName}`;
            if (sourceMetadata.NAICS) {
                tooltipContent += ` (${sourceMetadata.NAICS})`;
            }
            tooltipContent += `<br>To: ${targetName}`;
            if (targetMetadata.code && targetMetadata.code !== sourceMetadata.NAICS) {
                tooltipContent += ` (${targetMetadata.code})`;
            }
            
            tooltipContent += `<br>Value: ${originalValue !== undefined ? originalValue.toFixed(6) : 'N/A'}`;
            tooltipContent += `<br>Scaled: ${d.source.value.toFixed(6)}`;
            
            tooltip.innerHTML = tooltipContent;
            tooltip.style.opacity = 1;
            tooltip.style.left = (event.pageX + 10) + 'px';
            tooltip.style.top = (event.pageY - 10) + 'px';
        }
    }

    hideTooltip() {
        const tooltip = document.getElementById('chord-tooltip');
        if (tooltip) {
            tooltip.style.opacity = 0;
        }
    }
}

// Export for ES6 modules
export default ChordDiagram;