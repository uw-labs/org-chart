import * as d3 from 'd3'

//d3.select(self.frameElement).style("height", height + "px");

export default (containerId, vizFactory, name) => {

    let height = window.innerHeight-100
    let width = window.innerWidth

    function zoom() {
        viz.attr("transform", d3.event.transform)
    }

    const container = d3.select("#"+containerId).append('div').classed("svg-container", true)
        .style("width", `${width}px`)
        .style("height", `${height}px`)
        .style("background-color", "white");

    const svg = container.append("svg")
        .attr("preserveAspectRatio", "xMinYMin meet")
        //class to make it responsive
        .classed("svg-content-responsive", true)
        .attr("width", "100%")
        .attr("height", "100%")

    const vizContainer = svg.append("g")
        .attr("transform", "translate(" + width / 2 + "," + (height / 2) + ")")
        .call(d3.zoom().on("zoom", zoom)).on("dblclick.zoom", null)

    const defs = vizContainer.append('defs')

    defs.append('pattern')
        .attr('id', 'diagonalHatch')
        .attr('patternUnits', 'userSpaceOnUse')
        .attr('width', 4)
        .attr('height', 4)
        .append('path')
        .attr('shape-rendering', 'cripsEdges')
        .attr('d', 'M-1,1 l2,-2 M0,4 l4,-4 M3,5 l2,-2')
        .attr('stroke', '#000000')
        .attr('stroke-width', 1)
        .attr('opacity', 0.3)


    defs.append('pattern')
        .attr('id', 'pattern-stripe')
        .attr('width', 4)
        .attr('height', 4)
        .attr('patternUnits', 'userSpaceOnUse')
        .attr('patternTransform', 'rotate(45)')
        .append('rect')
        .attr('width' ,3)
        .attr('height', 4)
        .attr('transform', 'translate(0,0)')
        .attr('fill', 'gray')


    defs.append('mask')
        .attr('id', 'diagonalHatchMask')
        .append('rect')
        .attr('x', 0)
        .attr('y', 0)
        .attr('width', '100%')
        .attr('height', '100%')
        .attr('fill', 'url(#smallDot)')


    defs.append('pattern')
        .attr('id', 'smallDotColor')
        .attr('patternUnits', 'userSpaceOnUse')
        .attr('width', 4)
        .attr('height', 4)
        .append('image')
        .attr('href', "data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPSc1JyBoZWlnaHQ9JzUnPgo8cmVjdCB3aWR0aD0nNScgaGVpZ2h0PSc1JyBmaWxsPScjZmZmJy8+CjxyZWN0IHdpZHRoPScxJyBoZWlnaHQ9JzEnIGZpbGw9JyNjY2MnLz4KPC9zdmc+")
        .attr('x', 0)
        .attr('y', 0)

    defs.append('pattern')
        .attr('id', 'smallDot')
        .attr('patternUnits', 'userSpaceOnUse')
        .attr('width', 4)
        .attr('height', 4)
        .append('image')
        .attr('href', "data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPSc1JyBoZWlnaHQ9JzUnPgo8cmVjdCB3aWR0aD0nNScgaGVpZ2h0PSc1JyBmaWxsPScjZmZmJy8+CjxyZWN0IHdpZHRoPScxJyBoZWlnaHQ9JzEnIGZpbGw9JyNjY2MnLz4KPC9zdmc+")
        .attr('x', 0)
        .attr('y', 0)

    const viz = vizContainer.append("g").attr("class", "graph")
        .attr("width", "100%")
        .attr("height", "100%")


    viz.selectAll("*").remove();
    vizFactory(width, height, name)(viz)

}

export function exportToSVG(containerId) {
    const html = d3.select(`#${containerId} .svg-container svg`)
        .attr("version", 1.1)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .node().parentNode.innerHTML;

    const blob = new Blob([html], {type: "image/svg+xml"});

    return blob
}

