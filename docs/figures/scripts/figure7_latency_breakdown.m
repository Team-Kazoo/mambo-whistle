% Figure 7: Latency Breakdown
% Stacked horizontal bar chart showing pipeline stage contributions
% Mambo Whistle Technical Report
%
% Author: Mambo Whistle Team
% Date: 2025

clear; clc; close all;

%% ========================================================================
%  GOOGLE COLOR PALETTE
%  ========================================================================

google_blue   = [66, 133, 244] / 255;   % #4285F4
google_red    = [234, 67, 53] / 255;    % #EA4335
google_yellow = [251, 188, 5] / 255;    % #FBBC05
google_green  = [52, 168, 83] / 255;    % #34A853
google_gray   = [95, 99, 104] / 255;    % #5F6368

% Extended palette for 7 stages (audio thread: blues/greens, main thread: yellows/reds)
colors = [
    66, 133, 244;    % Microphone Capture - Google Blue
    52, 168, 83;     % Buffer Accumulation - Google Green
    23, 107, 135;    % YIN Processing - Teal
    102, 187, 106;   % FFT Processing - Light Green
    251, 188, 5;     % Message Transfer - Google Yellow (boundary)
    255, 167, 38;    % Synthesis - Orange
    234, 67, 53;     % DOM Rendering - Google Red
] / 255;

%% ========================================================================
%  LATENCY DATA (precise measurements from system)
%  ========================================================================

% Stage data: [AudioWorklet stages | Main thread stages]
% Values in milliseconds, based on actual system measurements

stages = {
    'Microphone Capture',    1.5,   'Audio Thread';
    'Buffer Accumulation',   12.0,  'Audio Thread';
    'YIN Pitch Detection',   0.5,   'Audio Thread';
    'FFT + Features',        0.1,   'Audio Thread';
    'Message Transfer',      0.8,   'Thread Boundary';
    'Synthesis Processing',  2.5,   'Main Thread';
    'DOM Rendering',         16.0,  'Main Thread';
};

stage_names = stages(:,1);
latencies = cell2mat(stages(:,2));
thread_types = stages(:,3);

% Total latency
total_latency = sum(latencies);

% Cumulative latencies for annotation
cumulative = cumsum(latencies);

%% ========================================================================
%  FIGURE SETUP
%  ========================================================================

figureUnits = 'centimeters';
figureWidth = 18;
figureHeight = 10;

figureHandle = figure('Name', 'Latency Breakdown');
set(gcf, 'Units', figureUnits, 'Position', [2 2 figureWidth figureHeight]);
set(gcf, 'Color', [1 1 1]);

hold on;

%% ========================================================================
%  STACKED HORIZONTAL BAR CHART
%  ========================================================================

% Create stacked bar data
bar_y = 1;
bar_height = 0.6;

% Draw each segment
x_start = 0;
for i = 1:length(latencies)
    % Draw bar segment
    rectangle('Position', [x_start, bar_y - bar_height/2, latencies(i), bar_height], ...
        'FaceColor', colors(i,:), ...
        'EdgeColor', [0.3 0.3 0.3], ...
        'LineWidth', 1, ...
        'Curvature', [0.05, 0.1]);

    % Add latency value inside bar (if wide enough)
    if latencies(i) > 2
        text(x_start + latencies(i)/2, bar_y, sprintf('%.1f ms', latencies(i)), ...
            'FontName', 'Times New Roman', 'FontSize', 9, ...
            'HorizontalAlignment', 'center', 'VerticalAlignment', 'middle', ...
            'Color', [1 1 1], 'FontWeight', 'bold');
    end

    x_start = x_start + latencies(i);
end

%% ========================================================================
%  100ms REFERENCE LINE
%  ========================================================================

% Perceptual threshold reference
xline(100, '--', 'Color', google_red, 'LineWidth', 2, 'Alpha', 0.8);
text(100, bar_y + 0.55, '100 ms Perceptual Threshold', ...
    'FontName', 'Times New Roman', 'FontSize', 10, ...
    'HorizontalAlignment', 'center', 'Color', google_red, ...
    'FontWeight', 'bold');

%% ========================================================================
%  THREAD BOUNDARY INDICATOR
%  ========================================================================

% Calculate boundary position (after Message Transfer starts)
boundary_x = sum(latencies(1:4)) + latencies(5)/2;

% Vertical dashed line for thread boundary
plot([boundary_x, boundary_x], [0.2, 1.8], ':', ...
    'Color', google_gray, 'LineWidth', 1.5);

% Thread labels
text(sum(latencies(1:4))/2, 0.35, 'AudioWorklet Thread', ...
    'FontName', 'Times New Roman', 'FontSize', 9, ...
    'HorizontalAlignment', 'center', 'Color', google_blue * 0.8, ...
    'FontStyle', 'italic');

text(boundary_x + (total_latency - boundary_x)/2, 0.35, 'Main Thread', ...
    'FontName', 'Times New Roman', 'FontSize', 9, ...
    'HorizontalAlignment', 'center', 'Color', google_red * 0.8, ...
    'FontStyle', 'italic');

%% ========================================================================
%  TOTAL LATENCY ANNOTATION
%  ========================================================================

% Arrow showing total latency
annotation('doublearrow', ...
    [0.1, 0.1 + (total_latency/120) * 0.75], [0.22, 0.22], ...
    'Color', [0.2 0.2 0.2], 'LineWidth', 1.2, ...
    'Head1Style', 'vback2', 'Head2Style', 'vback2', ...
    'Head1Length', 6, 'Head2Length', 6);

text(total_latency/2, 0.15, sprintf('Total: %.1f ms', total_latency), ...
    'FontName', 'Times New Roman', 'FontSize', 11, ...
    'HorizontalAlignment', 'center', 'FontWeight', 'bold', ...
    'Color', [0.2 0.2 0.2]);

%% ========================================================================
%  LEGEND (Stage names with colors)
%  ========================================================================

% Create legend with custom positioning
legend_y_start = 1.75;
legend_x = [3, 25, 50, 75];  % 4 columns
legend_row = [1, 1, 2, 2, 3, 3, 4];  % Row assignment
legend_col = [1, 2, 1, 2, 1, 2, 1];  % Column assignment

for i = 1:length(stage_names)
    lx = legend_x(legend_col(i));
    ly = legend_y_start + 0.22 * (1 - legend_row(i));

    % Color box
    rectangle('Position', [lx - 2, ly - 0.08, 1.5, 0.16], ...
        'FaceColor', colors(i,:), ...
        'EdgeColor', [0.3 0.3 0.3], ...
        'LineWidth', 0.5, ...
        'Curvature', [0.2, 0.4]);

    % Label
    text(lx + 0.5, ly, sprintf('%s (%.1f ms)', stage_names{i}, latencies(i)), ...
        'FontName', 'Times New Roman', 'FontSize', 8, ...
        'HorizontalAlignment', 'left', 'VerticalAlignment', 'middle', ...
        'Color', [0.2 0.2 0.2]);
end

%% ========================================================================
%  AXIS CONFIGURATION
%  ========================================================================

set(gca, 'XLim', [0, 120]);
set(gca, 'YLim', [0, 2.2]);

% X-axis ticks
set(gca, 'XTick', 0:20:120);
set(gca, 'XTickLabel', {'0', '20', '40', '60', '80', '100', '120'});

% Hide Y-axis (not meaningful for single bar)
set(gca, 'YTick', []);
set(gca, 'YColor', 'none');

%% ========================================================================
%  STYLING
%  ========================================================================

% Axis properties
set(gca, 'Box', 'off', ...
    'LineWidth', 1.2, ...
    'TickDir', 'out', ...
    'TickLength', [0.01 0.01], ...
    'XColor', [0.15 0.15 0.15], ...
    'XGrid', 'on', ...
    'GridLineStyle', ':', ...
    'GridAlpha', 0.3);

% Font settings
set(gca, 'FontName', 'Times New Roman', 'FontSize', 10);

% X-axis label
xlabel('Cumulative Latency (ms)', ...
    'FontName', 'Times New Roman', ...
    'FontSize', 12);

% Title
title('Audio Processing Pipeline Latency Breakdown', ...
    'FontName', 'Times New Roman', ...
    'FontSize', 13, ...
    'FontWeight', 'bold');

%% ========================================================================
%  ADD PERCENTAGE BREAKDOWN TABLE
%  ========================================================================

% Calculate percentages
percentages = latencies / total_latency * 100;

% Text box with percentage breakdown
table_str = sprintf(['Latency Distribution:\n' ...
    'Audio Thread: %.1f%% (%.1f ms)\n' ...
    'Main Thread: %.1f%% (%.1f ms)'], ...
    sum(percentages(1:4)), sum(latencies(1:4)), ...
    sum(percentages(6:7)), sum(latencies(6:7)));

annotation('textbox', [0.72, 0.45, 0.25, 0.2], ...
    'String', table_str, ...
    'FontName', 'Times New Roman', ...
    'FontSize', 9, ...
    'EdgeColor', google_gray, ...
    'BackgroundColor', [1 1 1 0.9], ...
    'HorizontalAlignment', 'left', ...
    'VerticalAlignment', 'top', ...
    'LineWidth', 1);

%% ========================================================================
%  COMPARISON BAR (AudioWorklet vs ScriptProcessor)
%  ========================================================================

% Add comparison section below main bar
comp_y = 0.55;
comp_height = 0.25;

% ScriptProcessor latency (for comparison)
script_processor_latency = 49.4;  % Based on 2048 sample buffer

% Draw comparison bars
% Mambo Whistle (AudioWorklet)
rectangle('Position', [0, comp_y - comp_height/2, total_latency, comp_height], ...
    'FaceColor', google_green, ...
    'EdgeColor', [0.3 0.3 0.3], ...
    'LineWidth', 0.8, ...
    'FaceAlpha', 0.7, ...
    'Curvature', [0.03, 0.15]);

text(total_latency + 2, comp_y, sprintf('AudioWorklet: %.1f ms', total_latency), ...
    'FontName', 'Times New Roman', 'FontSize', 8, ...
    'HorizontalAlignment', 'left', 'Color', google_green * 0.7);

% ScriptProcessor (legacy)
comp_y2 = 0.25;
rectangle('Position', [0, comp_y2 - comp_height/2, script_processor_latency, comp_height], ...
    'FaceColor', google_gray, ...
    'EdgeColor', [0.3 0.3 0.3], ...
    'LineWidth', 0.8, ...
    'FaceAlpha', 0.5, ...
    'Curvature', [0.03, 0.15]);

text(script_processor_latency + 2, comp_y2, sprintf('ScriptProcessor: %.1f ms', script_processor_latency), ...
    'FontName', 'Times New Roman', 'FontSize', 8, ...
    'HorizontalAlignment', 'left', 'Color', google_gray * 0.8);

% Improvement annotation
improvement = script_processor_latency / total_latency;
text(80, 0.4, sprintf('%.1fx improvement', improvement), ...
    'FontName', 'Times New Roman', 'FontSize', 9, ...
    'HorizontalAlignment', 'center', 'Color', google_green * 0.8, ...
    'FontWeight', 'bold', 'FontStyle', 'italic');

%% ========================================================================
%  EXPORT FIGURE
%  ========================================================================

% Set paper properties
set(figureHandle, 'PaperUnits', figureUnits);
set(figureHandle, 'PaperPosition', [0 0 figureWidth figureHeight]);
set(figureHandle, 'PaperSize', [figureWidth figureHeight]);

% Output paths
scriptPath = fileparts(mfilename('fullpath'));
outputPath = fullfile(scriptPath, '..', 'output');

% Export as PNG (300 DPI)
print(figureHandle, fullfile(outputPath, 'figure7_latency_breakdown.png'), ...
    '-dpng', '-r300');

% Export as PDF (vector)
print(figureHandle, fullfile(outputPath, 'figure7_latency_breakdown.pdf'), ...
    '-dpdf', '-bestfit');

% Export as EPS (vector)
print(figureHandle, fullfile(outputPath, 'figure7_latency_breakdown.eps'), ...
    '-depsc2');

fprintf('Figure 7 exported successfully!\n');
fprintf('Total latency: %.1f ms\n', total_latency);
fprintf('Margin below 100ms threshold: %.1f ms\n', 100 - total_latency);
fprintf('Output location: %s\n', outputPath);
