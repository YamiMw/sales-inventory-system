/**
 * Lightweight Offline Chart Library
 */
class OfflineChart {
  constructor(canvasId, options) {
    if (typeof canvasId === 'string') {
      this.canvas = document.getElementById(canvasId);
    } else {
      this.canvas = canvasId;
    }

    if (!this.canvas) {
      console.warn('Chart canvas not found:', canvasId);
      return;
    }

    this.ctx = this.canvas.getContext('2d');
    this.type = (options && options.type) || 'bar';
    this.data = (options && options.data) || { labels: [], datasets: [{ data: [] }] };
    this.padding = { top: 28, right: 54, bottom: 74, left: 52 };
    this.highlightIndex = -1;
    this.tooltip = null;
    this.width = 0;
    this.height = 0;
    this.bound = false;
    
    this.init();
  }

  init() {
    if (!this.canvas || !this.ctx) return;
    
    this.createTooltip();
    this.resize();
    
    this.canvas.addEventListener('mousemove', (e) => {
      if (!this.canvas) return;
      try {
        const rect = this.canvas.getBoundingClientRect();
        this.handleMouse(e.clientX - rect.left, e.clientY - rect.top);
      } catch(err) {}
    });
    
    this.canvas.addEventListener('mouseleave', () => {
      this.highlightIndex = -1;
      if (this.tooltip) this.tooltip.style.display = 'none';
      this.draw();
    });
    
    window.addEventListener('resize', () => {
      if (this.canvas) this.resize();
    });
    
    this.draw();
  }

  formatCompactCurrency(value) {
    if (window.AppFormatters?.formatCompactCurrency) {
      return window.AppFormatters.formatCompactCurrency(value);
    }
    return String(Number(value) || 0);
  }

  getLineScaleMax(maxV) {
    maxV = Number(maxV) || 1;
    if (maxV >= 1000000) return Math.ceil((maxV * 1.25) / 1000000) * 1000000;
    if (maxV >= 1000) return Math.ceil((maxV * 1.25) / 1000) * 1000;
    if (maxV >= 100) return Math.ceil((maxV * 1.25) / 100) * 100;
    return Math.ceil(maxV * 1.25) || 1;
  }

  drawSmoothPath(ctx, points, shouldMove) {
    if (!points.length) return;
    if (shouldMove !== false) {
      ctx.moveTo(points[0].x, points[0].y);
    }
    for (var i = 0; i < points.length - 1; i++) {
      var current = points[i];
      var next = points[i + 1];
      var midX = current.x + (next.x - current.x) / 2;
      ctx.bezierCurveTo(midX, current.y, midX, next.y, next.x, next.y);
    }
  }

  createTooltip() {
    if (!this.canvas || !this.canvas.parentElement) return;
    
    this.tooltip = document.createElement('div');
    this.tooltip.style.cssText = 'position:absolute;display:none;background:#111827;color:#fff;padding:6px 10px;border-radius:6px;font-size:11px;font-weight:600;pointer-events:none;z-index:100;white-space:nowrap;';
    this.canvas.parentElement.style.position = 'relative';
    this.canvas.parentElement.appendChild(this.tooltip);
  }

  positionTooltip(x, y) {
    if (!this.tooltip) return;

    var parent = this.canvas ? this.canvas.parentElement : null;
    var parentWidth = parent ? parent.clientWidth : this.width;
    var parentHeight = parent ? parent.clientHeight : this.height;
    var canvasLeft = this.canvas ? this.canvas.offsetLeft || 0 : 0;
    var canvasTop = this.canvas ? this.canvas.offsetTop || 0 : 0;
    var tooltipWidth = this.tooltip.offsetWidth || 120;
    var tooltipHeight = this.tooltip.offsetHeight || 30;
    var safeX = Math.max(
      8 + tooltipWidth / 2,
      Math.min(canvasLeft + x, parentWidth - 8 - tooltipWidth / 2)
    );
    var safeY = Math.max(8, Math.min(canvasTop + y, parentHeight - 8 - tooltipHeight));

    this.tooltip.style.left = safeX + 'px';
    this.tooltip.style.top = safeY + 'px';
    this.tooltip.style.transform = 'translate(-50%, 0)';
  }

  wrapLabel(ctx, label, maxWidth) {
    var text = String(label || '');
    if (!text) return [''];
    if (ctx.measureText(text).width <= maxWidth) return [text];

    var words = text.split(/\s+/);
    var lines = [];
    var current = '';

    words.forEach(function(word) {
      var candidate = current ? current + ' ' + word : word;
      if (ctx.measureText(candidate).width <= maxWidth) {
        current = candidate;
        return;
      }

      if (current) lines.push(current);

      if (ctx.measureText(word).width <= maxWidth) {
        current = word;
        return;
      }

      var chunk = '';
      for (var i = 0; i < word.length; i++) {
        var next = chunk + word[i];
        if (ctx.measureText(next).width > maxWidth && chunk) {
          lines.push(chunk);
          chunk = word[i];
        } else {
          chunk = next;
        }
      }
      current = chunk;
    });

    if (current) lines.push(current);
    return lines.length ? lines : [''];
  }

  resize() {
    if (!this.canvas) return;
    var p = this.canvas.parentElement;
    if (!p) return;

    var rect = p.getBoundingClientRect();
    this.width = rect.width || p.clientWidth || 400;
    this.height = rect.height || p.clientHeight || 250;

    if (this.width < 100) this.width = 400;
    if (this.height < 120) this.height = 360;

    this.canvas.style.width = this.width + 'px';
    this.canvas.style.height = this.height + 'px';
    this.canvas.width = this.width * 2;
    this.canvas.height = this.height * 2;
    
    if (this.ctx) {
      this.ctx.setTransform(2, 0, 0, 2, 0, 0);
      this.draw();
    }
  }

  handleMouse(mx, my) {
    if (!this.canvas || !this.tooltip) return;
    
    this.highlightIndex = -1;
    
    var data = this.data.datasets[0].data;
    if (!data || !data.length) return;
    
    var cw = this.width - this.padding.left - this.padding.right;
    var ch = this.height - this.padding.top - this.padding.bottom;
    var count = data.length;
    var maxV = Math.max.apply(null, data.concat([1]));
    var self = this;
    var found = false;

    if (this.type === 'bar') {
      var barEndGap = count > 1 ? Math.min(34, Math.max(22, cw * 0.045)) : 0;
      var barDrawableWidth = Math.max(cw - barEndGap, 1);
      var barCellWidth = barDrawableWidth / count;
      var bw = barCellWidth * 0.65;
      var gap = barCellWidth * 0.35;

      data.forEach(function(val, i) {
        var bx = self.padding.left + barCellWidth * i + gap / 2;
        if (mx >= bx && mx <= bx + bw) {
          self.highlightIndex = i;
          var barH = (val / maxV) * ch;
          var by = self.height - self.padding.bottom - barH;
          
          self.tooltip.style.display = 'block';
          self.tooltip.textContent = (self.data.labels[i] || '') + ': ' + self.formatCompactCurrency(val);
          self.positionTooltip(bx + bw / 2, by - 34);
          found = true;
        }
      });
    } else if (this.type === 'line') {
      var linePadding = { top: 36, right: 54, bottom: 90, left: 52 };
      var lineCw = this.width - linePadding.left - linePadding.right;
      var lineCh = this.height - linePadding.top - linePadding.bottom;
      var lineEndGap = count > 1 ? Math.min(34, Math.max(22, lineCw * 0.045)) : 0;
      var lineDrawableWidth = Math.max(lineCw - lineEndGap, 1);
      var step = count > 1 ? lineDrawableWidth / (count - 1) : lineDrawableWidth;
      var pointRadius = 8;
      var lineMaxV = this.getLineScaleMax(maxV);

      data.forEach(function(val, i) {
        var x = linePadding.left + step * i;
        var y = self.height - linePadding.bottom - (val / lineMaxV) * lineCh;
        var dx = mx - x;
        var dy = my - y;
        if (Math.sqrt(dx * dx + dy * dy) <= pointRadius) {
          self.highlightIndex = i;
          self.tooltip.style.display = 'block';
          self.tooltip.textContent = (self.data.labels[i] || '') + ': ' + self.formatCompactCurrency(val);
          self.positionTooltip(x, y - 34);
          found = true;
        }
      });
    } else if (this.type === 'pie') {
      var geometry = this.getPieGeometry(data);
      var pieDx = mx - geometry.centerX;
      var pieDy = my - geometry.centerY;
      var distance = Math.sqrt(pieDx * pieDx + pieDy * pieDy);

      if (distance <= geometry.radius) {
        var angle = Math.atan2(pieDy, pieDx);
        if (angle < -Math.PI / 2) angle += Math.PI * 2;
        var total = data.reduce(function(sum, value) {
          return sum + Math.max(Number(value) || 0, 0);
        }, 0);
        var cursor = -Math.PI / 2;

        data.some(function(value, i) {
          var slice = total > 0 ? (Math.max(Number(value) || 0, 0) / total) * Math.PI * 2 : 0;
          if (angle >= cursor && angle <= cursor + slice) {
            self.highlightIndex = i;
            self.tooltip.style.display = 'block';
            self.tooltip.textContent = (self.data.labels[i] || '') + ': ' +
              self.formatCompactCurrency(value);
            self.positionTooltip(mx, my - 34);
            found = true;
            return true;
          }
          cursor += slice;
          return false;
        });
      }
    }
    
    if (!found && this.tooltip) {
      this.tooltip.style.display = 'none';
    }
    
    this.draw();
  }

  draw() {
    if (!this.ctx || !this.width) return;
    
    var ctx = this.ctx;
    var w = this.width;
    var h = this.height;
    var p = this.padding;
    
    ctx.clearRect(0, 0, w, h);
    
    if (this.type === 'bar' && this.data.datasets[0] && this.data.datasets[0].data) {
      this.drawBars(ctx, w, h, p);
    } else if (this.type === 'line' && this.data.datasets[0] && this.data.datasets[0].data) {
      this.drawLine(ctx, w, h, p);
    } else if (this.type === 'pie' && this.data.datasets[0] && this.data.datasets[0].data) {
      this.drawPie(ctx, w, h);
    }
  }

  getPieGeometry(data) {
    var labels = this.data.labels || [];
    var labelWidth = Math.max(this.width - 118, 80);
    var legendHeight = labels.reduce(function(total, label) {
      var estimatedLineCount = Math.max(1, Math.ceil(String(label || '').length / Math.max(labelWidth / 6, 1)));
      return total + Math.max(24, estimatedLineCount * 12 + 8);
    }, 0);
    legendHeight = Math.max(legendHeight, 24);
    var availableHeight = Math.max(this.height - legendHeight - 44, 120);
    var radius = Math.max(
      42,
      Math.min(this.width * 0.3, availableHeight * 0.43, 96)
    );

    return {
      centerX: this.width / 2,
      centerY: 18 + radius,
      radius: radius,
      legendTop: 34 + radius * 2
    };
  }

  truncateLabel(ctx, label, maxWidth) {
    var text = String(label || '');
    if (ctx.measureText(text).width <= maxWidth) return text;
    while (text.length > 1 && ctx.measureText(text + '...').width > maxWidth) {
      text = text.slice(0, -1);
    }
    return text + '...';
  }

  drawPie(ctx, w, h) {
    var dataset = this.data.datasets[0] || {};
    var data = dataset.data || [];
    var labels = this.data.labels || [];
    var colors = dataset.backgroundColor || [];
    var total = data.reduce(function(sum, value) {
      return sum + Math.max(Number(value) || 0, 0);
    }, 0);
    if (!data.length || total <= 0) return;

    var geometry = this.getPieGeometry(data);
    var cursor = -Math.PI / 2;
    var self = this;

    data.forEach(function(value, i) {
      var normalizedValue = Math.max(Number(value) || 0, 0);
      var slice = (normalizedValue / total) * Math.PI * 2;
      var end = cursor + slice;
      var middle = cursor + slice / 2;
      var isHover = i === self.highlightIndex;
      var offset = isHover ? 5 : 0;
      var centerX = geometry.centerX + Math.cos(middle) * offset;
      var centerY = geometry.centerY + Math.sin(middle) * offset;

      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, geometry.radius, cursor, end);
      ctx.closePath();
      ctx.fillStyle = colors[i] || '#94a3b8';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      var percentage = normalizedValue / total;
      if (percentage >= 0.1) {
        var labelRadius = geometry.radius * 0.62;
        ctx.fillStyle = '#ffffff';
        ctx.font = '700 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(
          Math.round(percentage * 100) + '%',
          centerX + Math.cos(middle) * labelRadius,
          centerY + Math.sin(middle) * labelRadius
        );
      }

      cursor = end;
    });

    var legendTop = geometry.legendTop;
    var legendY = legendTop;
    var gapOffset = 20;
    data.forEach(function(value, i) {
      var lines = self.wrapLabel(ctx, labels[i], Math.max(w - 118, 80));
      var rowHeight = Math.max(24, lines.length * 12 + 8);
      var y = legendY;
      var percentage = Math.round((Math.max(Number(value) || 0, 0) / total) * 100);

      var labelY = y + 11;
      ctx.fillStyle = colors[i] || '#94a3b8';
      ctx.beginPath();
      ctx.roundRect(14, labelY - 5, 10, 10, 2);
      ctx.fill();

      ctx.fillStyle = '#334155';
      ctx.font = '600 10px sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      lines.forEach(function(line, lineIndex) {
        ctx.fillText(line, 32, labelY + lineIndex * 12);
      });

      var labelLineWidth = ctx.measureText(lines[0] || '').width || 0;
      var percentageX = Math.min(w - 12, 32 + labelLineWidth + gapOffset);

      ctx.fillStyle = '#64748b';
      ctx.font = '700 10px sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(percentage + '%', percentageX, labelY);
      legendY += rowHeight;
    });
  }

  drawBars(ctx, w, h, p) {
    var data = this.data.datasets[0].data;
    var labels = this.data.labels || [];
    var cw = w - p.left - p.right;
    var ch = h - p.top - p.bottom;
    var maxV = Math.max.apply(null, data.concat([1]));
    var count = data.length;
    if (!count) return;
    var endGap = count > 1 ? Math.min(34, Math.max(22, cw * 0.045)) : 0;
    var drawableWidth = Math.max(cw - endGap, 1);
    var cellWidth = drawableWidth / count;
    var bw = cellWidth * 0.65;
    var gap = cellWidth * 0.35;
    var self = this;

    // Grid lines
    for (var i = 0; i <= 2; i++) {
      var gy = h - p.bottom - (ch / 2) * i;
      if (gy < p.top) continue;
      
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(229, 231, 235, 0.45)';
      ctx.lineWidth = 1;
      ctx.moveTo(p.left, gy);
      ctx.lineTo(w - p.right, gy);
      ctx.stroke();

      var gv = (maxV / 2) * i;
      ctx.fillStyle = '#9ca3af';
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(this.formatCompactCurrency(gv), p.left - 6, gy + 3);
    }

    // Bars
    data.forEach(function(val, i) {
      var x = p.left + cellWidth * i + gap / 2;
      var barH = Math.max(2, (val / maxV) * ch);
      var y = h - p.bottom - barH;
      var isHover = i === self.highlightIndex;

      // Bar
      ctx.fillStyle = isHover ? '#b91c1c' : '#dc2626';
      ctx.beginPath();
      ctx.moveTo(x + 4, y);
      ctx.lineTo(x + bw - 4, y);
      ctx.quadraticCurveTo(x + bw, y, x + bw, y + 4);
      ctx.lineTo(x + bw, y + barH - 4);
      ctx.quadraticCurveTo(x + bw, y + barH, x + bw - 4, y + barH);
      ctx.lineTo(x + 4, y + barH);
      ctx.quadraticCurveTo(x, y + barH, x, y + barH - 4);
      ctx.lineTo(x, y + 4);
      ctx.quadraticCurveTo(x, y, x + 4, y);
      ctx.closePath();
      ctx.fill();

      // Value
      ctx.fillStyle = isHover ? '#ffffff' : '#111827';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(self.formatCompactCurrency(val), x + bw / 2, Math.max(p.top + 10, y - 6));

      // X label
      ctx.fillStyle = '#9ca3af';
      ctx.font = '600 9px sans-serif';
      var label = labels[i] || '';
      var labelX = x + bw / 2;
      var rotateLabel = count > 10 || cellWidth < 42;
      ctx.save();
      if (rotateLabel) {
        ctx.translate(labelX, h - p.bottom + 28);
        ctx.rotate(-Math.PI / 4);
        ctx.textAlign = 'right';
        ctx.fillText(label, 0, 0);
      } else {
        ctx.textAlign = 'center';
        ctx.fillText(label, labelX, h - p.bottom + 18);
      }
      ctx.restore();
    });
  }

  drawLine(ctx, w, h, p) {
    var data = this.data.datasets[0].data;
    var labels = this.data.labels || [];
    
    var linePadding = { top: 36, right: 54, bottom: 90, left: 52 };
    var cw = w - linePadding.left - linePadding.right;
    var ch = h - linePadding.top - linePadding.bottom;
    var rawMax = Math.max.apply(null, data.concat([1]));
    var maxV = this.getLineScaleMax(rawMax);
    var count = data.length;
    var endGap = count > 1 ? Math.min(34, Math.max(22, cw * 0.045)) : 0;
    var drawableWidth = Math.max(cw - endGap, 1);
    var step = count > 1 ? drawableWidth / (count - 1) : drawableWidth;
    var self = this;
    var p = linePadding;
    var baseline = h - p.bottom;
    var points = data.map(function(val, i) {
      return {
        x: p.left + step * i,
        y: baseline - (val / maxV) * ch,
        value: val
      };
    });

    // Y-axis grid lines and labels
    for (var i = 0; i <= 4; i++) {
      var gy = baseline - (ch / 4) * i;
      if (gy < p.top) continue;
      ctx.beginPath();
      ctx.setLineDash([2, 4]);
      ctx.strokeStyle = '#e5e7eb';
      ctx.lineWidth = 1;
      ctx.moveTo(p.left, gy);
      ctx.lineTo(w - p.right, gy);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = '#4b635e';
      ctx.font = '600 10px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(this.formatCompactCurrency((maxV / 4) * i), p.left - 10, gy + 3);
    }

    if (!points.length) return;

    // Fill area under the smooth line
    ctx.beginPath();
    ctx.moveTo(points[0].x, baseline);
    ctx.lineTo(points[0].x, points[0].y);
    this.drawSmoothPath(ctx, points, false);
    ctx.lineTo(points[points.length - 1].x, baseline);
    ctx.closePath();
    var fill = ctx.createLinearGradient(0, p.top, 0, baseline);
    fill.addColorStop(0, 'rgba(255, 28, 45, 0.18)');
    fill.addColorStop(1, 'rgba(255, 28, 45, 0)');
    ctx.fillStyle = fill;
    ctx.fill();

    // Smooth line path
    ctx.beginPath();
    ctx.strokeStyle = '#ff1c2d';
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    this.drawSmoothPath(ctx, points);
    ctx.stroke();

    // X axis labels
    var rotateLabels = count > 12 || step < 54;
    labels.forEach(function(label, i) {
      var x = p.left + step * i;
      ctx.fillStyle = '#4b635e';
      ctx.font = '600 10px sans-serif';
      ctx.save();
      if (rotateLabels) {
        ctx.translate(x, baseline + 32);
        ctx.rotate(-Math.PI / 4);
        ctx.textAlign = 'right';
        ctx.fillText(label || '', 0, 0);
      } else {
        ctx.textAlign = 'center';
        ctx.fillText(label || '', x, baseline + 24);
      }
      ctx.restore();
    });

    // Points and hover labels
    var showPointValues = count <= 12 || step >= 44;
    points.forEach(function(point, i) {
      var isHover = i === self.highlightIndex;

      ctx.beginPath();
      ctx.arc(point.x, point.y, isHover ? 5 : 3, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.lineWidth = isHover ? 3 : 2;
      ctx.strokeStyle = '#ff1c2d';
      ctx.stroke();

      if (showPointValues || isHover) {
        ctx.fillStyle = '#111827';
        ctx.font = isHover ? '700 12px sans-serif' : '600 9px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(
          self.formatCompactCurrency(point.value),
          point.x,
          Math.max(p.top + 10, point.y - 14)
        );
      }
    });
  }

  destroy() {
    if (this.tooltip && this.tooltip.parentNode) {
      this.tooltip.parentNode.removeChild(this.tooltip);
    }
    this.tooltip = null;
    this.canvas = null;
    this.ctx = null;
  }
}

window.OfflineChart = OfflineChart;
