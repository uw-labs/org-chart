import * as d3 from 'd3'

function checkWithinParent(subject, lookForID) {
    let parent = subject.parent
    while(parent) {
        if (lookForID === parent.data.id) {
            return true
        }
        parent = parent.parent
    }

    return false;
}

export default (nodes) => {

    return (width, height, name) => {

        d3.select("svg").attr("title", name)

        const radius = (Math.min(width, height) / 2) + 50;

        const x = d3.scaleLinear()
            .range([0, 2 * Math.PI]);

        const y = d3.scaleLinear()
            .range([0, radius]);

        const color = d3.scaleOrdinal(d3.schemeCategory20);

        const label = (d, always) => {
            if (d.id === 'technology_board') {
                return "Technology Board"
            }
            if (d.id === 'product_board') {
                return "Product Board"
            }
            if (d.type === 'team') {
                return `${d.name} ${d.group_actual}/${d.group}`
            }

            if (d.type === "TEMP") {
                return "[TMP] "+d.name
            }

            if (d.type === "CONTRACTOR") {
                return "[CON] "+d.name
            }

            if (d.type === "AGENCY_CONTRACTOR") {
                return "[AGN] "+d.name
            }

            if (d.kind === 'vacancy') {
                return "[HC] "+d.name
            }

            if (d.kind === 'backfill') {
                return "[BF] "+d.name
            }

            if (d.name) {
                return d.name
            }
            return always ? d.title : ''
        }

        const arc = d3.arc()
            .startAngle(function (d) {
                return Math.max(0, Math.min(2 * Math.PI, x(d.x0)));
            })
            .endAngle(function (d) {
                return Math.max(0, Math.min(2 * Math.PI, x(d.x1)));
            })
            .innerRadius(function (d) {
                return Math.max(0, y(d.y0));
            })
            .outerRadius(function (d) {
                return Math.max(0, y(d.y1));
            });

        const getAngle = (d) => {
            const thetaDeg = (180 / Math.PI * (arc.startAngle()(d) + arc.endAngle()(d)) / 2 - 90);
            return (thetaDeg > 90) ? thetaDeg - 180 : thetaDeg;
        }

        const partition = d3.partition();

        const root = d3.hierarchy(nodes, d => {
            return d.children
        });

        root.sum(function (d) {
            return d.children && d.children.length > 0 ? 0 : 100
        });

        return (viz) => {

            const rotate = {
                start: {
                    x: null,
                    y: null,
                    angle: null
                }
            }



            const path = viz.selectAll("path")
                .data(partition(root).descendants())
                .enter().append("g")
                .attr('transform', 'rotate(0, 0, 0)')
                .call(d3.drag()
                    .filter(() => {
                        return d3.event.shiftKey
                    })
                    .on("start", () => {
                        rotate.start.x = d3.event.x
                        rotate.start.y = d3.event.y
                        const matches = path.attr('transform').match(/rotate\(([-+]?([0-9]*\.[0-9]+|[0-9]+)).*/)
                        rotate.start.angle = parseFloat(matches[1])
                    })
                    .on("drag", () => {
                        const rotation = Math.atan2(d3.event.y - rotate.start.y, d3.event.x - rotate.start.x) * 180 / Math.PI;

                        path.attr('transform', `rotate(${rotate.start.angle + rotation}, 0, 0)`)



                    })
                )



            path.append("path")
                .attr("d", arc)
                .style("fill", function (d) {

                    if ((d.data.kind === 'vacancy' || d.data.kind === 'backfill') && d.data.name.endsWith("ENGINEERING") ) {
                        return 'url(#smallDot)'
                    }
                    if (d.data.kind === 'vacancy' || d.data.kind === 'backfill') {
                        return 'url(#diagonalHatch)'
                    }

                    if(d.data.type && d.data.type !== "EMPLOYEE") {
                        //return 'gray'
                    }

                    return color(label((d.children ? d : d.parent).data, true));
                })
                .attr("stroke", "black")
                .attr("stoke-width", 0.2)
                .attr("fill-opacity", function(d) {

                    if (d.data.startDate) {
                        return 0.60
                    }
                    return 1
                })
                .style("mask", (d) => {
                    // can this be used for different employee styles?
                    return null
                })
                .on("dblclick", click)



            const text = path.append("text")
                .text(function (d) {

                    return label(d.data, 1)
                })
                .attr("x", function (d) {
                    return d.x;
                })
                .attr("text-anchor", "middle")
                // translate to the desired point and set the rotation
                .attr("transform", function (d) {
                    if (d.depth > 0) {
                        return "translate(" + arc.centroid(d) + ")" +
                            "rotate(" + getAngle(d) + ")";
                    } else {
                        return null;
                    }
                })
                .attr("dx", "3") // margin
                .attr("dy", ".35em") // vertical-align
                .attr("pointer-events", "none")
                .style("font-size", "0.65em")



            function click(d, e) {

                text.transition().attr("opacity", 0);

                viz.transition()
                    .duration(350)
                    .tween("scale", function () {
                        var xd = d3.interpolate(x.domain(), [d.x0, d.x1]),
                            yd = d3.interpolate(y.domain(), [d.y0, 1]),
                            yr = d3.interpolate(y.range(), [d.y0 ? 20 : 0, radius]);
                        return function (t) {
                            x.domain(xd(t));
                            y.domain(yd(t)).range(yr(t));
                        };
                    })
                    .selectAll("path")
                    .attrTween("d", function (d) {
                        return function () {
                            return arc(d);
                        };
                    })
                    .on("end", function (e, i) {
                        // check if the animated element's data e lies within the visible angle span given in d

                        const inParent = checkWithinParent(e,d.data.id)

                        if (
                            inParent ||
                            (e.data.id === d.data.id) // ||
                           // (e.parent && e.parent.data.id === d.data.id) ||
                            //(e.x0 >= d.x0 && e.x1 <= d.x1)
                        ) {
                            // get a selection of the associated text element
                            var arcText = d3.select(this.parentNode).select("text");
                            // fade in the text element and recalculate positions
                            arcText.transition().duration(750)
                                .attr("opacity", 1)
                                .attr("transform", function (d) {
                                    if (d.depth > 0) {
                                        return "translate(" + arc.centroid(e) + ")" +
                                            "rotate(" + getAngle(e) + ")";
                                    } else {
                                        return null;
                                    }
                                })
                                //.attr("transform", function() { return "rotate(" + getAngle(e) + ")" })
                                //.attr("x", function(d) { return y(d.y); })
                                .attr("x", function (d) {return e.x;})
                        }
                    });
            }
        }
    }
}



