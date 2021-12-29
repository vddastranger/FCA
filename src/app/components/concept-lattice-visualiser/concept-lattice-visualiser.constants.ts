import { ConceptLatticeFromServer, ConceptLatticeNode } from '../../models/concept-lattices.model';

declare var d3: any;

export const conceptLattice: any = {
  settings: {
    collisionDetection: false,
    showTopLabels: true,
    showBottomLabels: true,
    analogicalComplexId: -1,
    collapseLabels: false,
    circleRadius: 18,
    circleRadiusVariation: 7,
    linkDistance: 160,
    textTopOffset: '-2em',
    textBottomOffset: '3em',
  },
};

function getNodeColor(node: any) {
  const graph = conceptLattice.graph;
  const ramp = d3.scale.linear().domain([0, graph.nodes[graph.lastNode].level]).range(["#8f4fff", "#4600bd"]);
  return ramp(node.level);
}

function collide(node: any) {
  let textLength = 0;
  if (conceptLattice.settings.collapseLabels && conceptLattice.settings.showTopLabels) {
    textLength = Math.max(textLength, conceptLattice.topLabels[0][node.index].getComputedTextLength());
  }
  if (conceptLattice.settings.collapseLabels && conceptLattice.settings.showBottomLabels) {
    textLength = Math.max(conceptLattice.bottomLabels[0][node.index].getComputedTextLength(), textLength);
  }

  let nodeRadius = Math.max(15, textLength / 2) + 7;
  let nx1 = node.x - nodeRadius;
  let nx2 = node.x + nodeRadius;

  return function(quad, x1, y1, x2, y2) {
    if (quad.point && (quad.point !== node) && (quad.point.level == node.level)) {
      var x = node.x - quad.point.x;
      var y = node.initialY - quad.point.initialY;
      var distanceBetweenNodes = Math.sqrt(x * x + y * y);
      let quadTextLength = 0;
      if (conceptLattice.settings.collapseLabels && conceptLattice.settings.showTopLabels) {
        quadTextLength = Math.max(quadTextLength, conceptLattice.topLabels[0][quad.point.index].getComputedTextLength());
      }
      if (conceptLattice.settings.collapseLabels && conceptLattice.settings.showBottomLabels) {
        quadTextLength = Math.max(conceptLattice.bottomLabels[0][quad.point.index].getComputedTextLength(), quadTextLength);
      }

      let quadRadius = Math.max(15, quadTextLength / 2) + 7;
      var distanceBetweenColliders = nodeRadius + quadRadius;
    }

    if (distanceBetweenNodes > 0 && distanceBetweenColliders - distanceBetweenNodes > 0) {
      const lerpDistance = (distanceBetweenNodes - distanceBetweenColliders) / distanceBetweenNodes * .5;
      node.x -= x *= lerpDistance;
      quad.point.x += x;
    }

    return x1 > nx2 || x2 < nx1;
  };
}

export function drawGraph(graph: ConceptLatticeFromServer) {
  conceptLattice.graph = graph;
  const lastNode = graph.nodes[graph.lastNode];
  const width = window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth;;
  const height = graph.maxLevel * 100;

  graph.nodes.forEach(function (node, index) {
    node.x = width / 2 - conceptLattice.settings.circleRadius + index;
    node.y = 50 + (node.level - 1) * 100;
    node.initialY = node.y;
    node.ownedObjects = node.objects;
    node.ownedAttributes = node.attributes;
  });

  graph.nodes[0].fixed = true;
  lastNode.fixed = true;

  graph.links.forEach(function (link, index) {
    const sourceNode = graph.nodes[link.source];
    const targetNode = graph.nodes[link.target];

    targetNode.ownedAttributes = targetNode.ownedAttributes.filter(function (x) {
      return sourceNode.attributes.indexOf(x) < 0;
    });
    sourceNode.ownedObjects = sourceNode.ownedObjects.filter(function (x) {
      return targetNode.objects.indexOf(x) < 0;
    });
  });

  conceptLattice.force = d3.layout.force()
    .charge(function (d, i) {
      return -240;
    })
    .linkDistance(function (l) {
      return Math.abs(l.source.level - l.target.level) * conceptLattice.settings.linkDistance - 20;
    })
    .size([width, height])
    .gravity(0)
  ;

  const svg = d3.select(".concept-lattice-container").append("svg")
    .attr("width", width)
    .attr("height", height)
    .style("font-family", '"Helvetica Neue", Helvetica, Arial, sans-serif')
    .style("font-size", "14px")
    .style("line-height", "1.42857143")
    .style("color", "#333")
    .style("background-color", "#FFF")
    .attr("class", "my-svg")
    .on("mousedown", function () {
      if (!conceptLattice.conceptClicked) {
        conceptLattice.links
          .style("stroke-width", "1px");

        conceptLattice.nodes
          .attr("r", conceptLattice.settings.circleRadius)
          .style("fill", function (d) {
            return getNodeColor(d);
          });

        conceptLattice.force.resume();
      }
    });

  conceptLattice.force
    .nodes(graph.nodes)
    .links(graph.links)
    .start();

  conceptLattice.links = svg.selectAll(".link")
    .data(graph.links)
    .enter()
    .append("line")
    .attr("class", "link")
    .style("stroke-width", "0.6")
    .style("stroke", "#999");

  conceptLattice.mouseMove = 0;
  conceptLattice.gnodes = svg.selectAll('g.gnode')
    .data(graph.nodes)
    .enter()
    .append('g')
    .classed('gnode', true)
    .on("mouseover", function () {
      if (!conceptLattice.settings.showTopLabels) {
        // @ts-ignore
        return d3.select(this).select("text").style("visibility", "visible");
      }
      if (!conceptLattice.settings.showBottomLabels) {
        // @ts-ignore
        return d3.select(d3.select(this).selectAll("text")[0][1]).style("visibility", "visible");
      }
    })
    .on("mouseout", function () {
      if (!conceptLattice.settings.showTopLabels) {
        // @ts-ignore
        return d3.select(this).select("text").style("visibility", "hidden");
      }
      if (!conceptLattice.settings.showBottomLabels) {
        // @ts-ignore
        return d3.select(d3.select(this).selectAll("text")[0][1]).style("visibility", "hidden");
      }
    })
    .on("dblclick", function (d, i) {
      d.fixed = false;
      conceptLattice.force.resume();
    })
    .on("mousemove", function (d, i) {
      conceptLattice.mouseMove += 1;

      if (conceptLattice.conceptClicked == true && conceptLattice.mouseMove > 15) {
        conceptLattice.conceptWasDragged = true;
      }
    })
    .on("mousedown", function (d, i) {
      conceptLattice.conceptClicked = true;
    })
    .on("mouseup", function (d, i) {
      conceptLattice.mouseMove = 0;
      conceptLattice.conceptClicked = false;
      if (conceptLattice.conceptWasDragged) {
        d.fixed = true;
        conceptLattice.conceptWasDragged = false;
      } else {
        var mainNode = d;
        var markedNodes = [];

        conceptLattice.links
          .style("stroke-width", function (d, i) {
            var diff1 = mainNode.attributes.filter(function (x) {
              return d.source.attributes.indexOf(x) < 0;
            }).length + mainNode.attributes.filter(function (x) {
              return d.target.attributes.indexOf(x) < 0;
            }).length;
            var diff2 = mainNode.objects.filter(function (x) {
              return d.source.objects.indexOf(x) < 0;
            }).length + mainNode.objects.filter(function (x) {
              return d.target.objects.indexOf(x) < 0;
            }).length;

            if (diff1 == 0 || diff2 == 0) {
              // @ts-ignore
              d3.select(this).style("stroke", "#9900ff");
              markedNodes.push(d.source.index);
              markedNodes.push(d.target.index);

              return "3px";
            }

            return "1px";
          });

        conceptLattice.nodes
          .attr("r", function (d, i) {
            if (markedNodes.indexOf(d.index) >= 0) {
              return conceptLattice.settings.circleRadius;
            }

            return conceptLattice.settings.circleRadius - (conceptLattice.settings.circleRadiusVariation);
          })
          .style("fill", function (d) {
            return getNodeColor(d);
          });

        // @ts-ignore
        d3.select(this).select("circle")
          .attr("r", conceptLattice.settings.circleRadius)
          .style("fill", "#EB9316");
      }

      conceptLattice.force.resume();
    })
    .call(conceptLattice.force.drag)
  ;

  conceptLattice.nodes = conceptLattice.gnodes.append("circle")
    .attr("class", "node")
    .attr("r", conceptLattice.settings.circleRadius)
    .style("stroke", "#FFF")
    .style("stroke-width", "1.5px")
    .style("fill", function (d) {
      return getNodeColor(d);
    });

  conceptLattice.topLabels = conceptLattice.gnodes.append("text")
    .attr("x", 0)
    .attr("dy", conceptLattice.settings.textTopOffset)
    .attr("text-anchor", "middle")
    .text(function (d) {
      if (conceptLattice.settings.collapseLabels) {
        return d.ownedAttributes.join(" | ");
      } else {
        return d.attributes.join(" | ");
      }
    });

  conceptLattice.bottomLabels = conceptLattice.gnodes.append("text")
    .attr("x", 0)
    .attr("dy", conceptLattice.settings.textBottomOffset)
    .attr("text-anchor", "middle")
    .text(function (d) {
      if (conceptLattice.settings.collapseLabels) {
        return d.ownedObjects.join(" | ");
      } else {
        return d.objects.join(" | ");
      }
    });

  if (!conceptLattice.settings.showTopLabels) {
    conceptLattice.topLabels.style("visibility", "hidden");
  }
  if (!conceptLattice.settings.showBottomLabels) {
    conceptLattice.bottomLabels.style("visibility", "hidden");
  }

  conceptLattice.force.on("tick", function () {
    var nodes = graph.nodes;

    if (conceptLattice.settings.collisionDetection) {
      var q = d3.geom.quadtree(nodes);
      var i = 0;
      var n = nodes.length;

      while (++i < n) q.visit(collide(nodes[i]));
    }

    conceptLattice.links
      .attr("x1", function (d) {
        return d.source.x;
      })
      .attr("y1", function (d) {
        return d.source.initialY;
      })
      .attr("x2", function (d) {
        return d.target.x;
      })
      .attr("y2", function (d) {
        return d.target.initialY;
      });

    conceptLattice.nodes
      .style("fill", function (d) {
        return getNodeColor(d);
      });

    // Translate the groups
    conceptLattice.gnodes.attr("transform", function (d) {
      return 'translate(' + [d.x, d.initialY] + ')';
    });
  });

  // if (typeof LOCKABLE_ELEMENTS != 'undefined') {
  //   conceptLattice.gnodes.on("contextmenu", function (d, i) {
  //     d3.event.preventDefault();
  //
  //     var triadicConcept = d.triadicConcept;
  //
  //     d3.selectAll(".node-popup").remove();
  //
  //     var parentOffset = $(".concept-lattice-container").offset();
  //     var relX = d3.event.pageX - parentOffset.left;
  //     var relY = d3.event.pageY - parentOffset.top;
  //
  //     var popup = d3.select(".concept-lattice-container")
  //       .append("div")
  //       .attr("class", "node-popup")
  //       .style("left", relX + "px")
  //       .style("top", relY + "px");
  //
  //     popup.append("h3").attr("class", "popup-title").text("Triadic Concept");
  //     var content = popup.append("div").attr("class", "popup-content");
  //     var lockList = content.append("div").attr("class", "dimensions-lock-list");
  //
  //     var group, btnClass;
  //     var key, value;
  //     var dimensions = ["object", "attribute", "condition"];
  //
  //     for (var dimKey = 0; dimKey < 3; dimKey++) {
  //       group = lockList.append("div")
  //         .attr("class", "btn-group")
  //         .attr("role", "group")
  //         .attr("data-group", dimensions[dimKey])
  //       ;
  //       for (key in triadicConcept[dimKey]) {
  //         value = triadicConcept[dimKey][key];
  //         btnClass = "btn-default";
  //
  //         if (conceptLattice.graph.lock.indexOf(value) > -1) {
  //           btnClass = "btn-success";
  //         }
  //
  //         group.append("a").attr("class", "btn " + btnClass).attr("data-value", value).text(value);
  //       }
  //       lockList.append("br");
  //     }
  //
  //     lockList.append("button").attr("class", "btn btn-primary apply-dimensions-lock").text("Lock");
  //   });
  // }

  // if (typeof graph.analogicalComplexes != 'undefined') {
  //   var select = $("#choose_complex");
  //   for (var index in graph.analogicalComplexes) {
  //     $("<option>").text(index).val(index).appendTo(select);
  //   }
  // } else {
  //   $(".complex-selector").remove();
  // }
  //
  //
  // $(".printable-concept-lattice-btn").click(function () {
  //   var svgString = getSVGString(svg.node());
  //   svgString2Image(svgString, 8 * width, 8 * height);
  // });
}

export function orderNodesByLevel(lattice: ConceptLatticeFromServer): ConceptLatticeFromServer {
  lattice.nodes.sort(srt);
  return lattice;
}

function srt(a: ConceptLatticeNode, b: ConceptLatticeNode): number {
  return a.level - b.level;
}

