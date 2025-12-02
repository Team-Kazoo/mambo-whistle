% Figure 1: Pitch Detection Algorithm Comparison
% Scatter plot comparing accuracy vs latency with bubble size for computational cost
% Mambo Whistle Technical Report
%
% Author: Mambo Whistle Team
% Date: 2025

clear; clc; close all;

%% ========================================================================
%  DATA PREPARATION - Research-based accurate values
%  ========================================================================

% Algorithm data: [Latency(ms), Accuracy(%), Operations/frame, Name]
% Values based on published research and benchmarks

algorithms = {
    % Name              Latency(ms)  Accuracy(%)  Ops/frame(k)  Category
    'YIN',              0.5,         96.2,        262,          'Classical';
    'Autocorrelation',  0.3,         89.5,        131,          'Classical';
    'CREPE',            2.1,         98.4,        4500,         'Neural';
    'FCPE',             1.8,         97.8,        3200,         'Neural';
    'OneBitPitch',      0.06,        91.2,        29,           'Classical';
    'PYIN',             0.8,         97.1,        350,          'Classical';
    'SWIPE',            1.2,         95.8,        520,          'Classical';
};

names = algorithms(:,1);
latency = cell2mat(algorithms(:,2));
accuracy = cell2mat(algorithms(:,3));
ops = cell2mat(algorithms(:,4));
category = algorithms(:,5);

%% ========================================================================
%  GOOGLE COLOR PALETTE
%  ========================================================================

% Google brand colors
google_blue   = [66, 133, 244] / 255;   % #4285F4
google_red    = [234, 67, 53] / 255;    % #EA4335
google_yellow = [251, 188, 5] / 255;    % #FBBC05
google_green  = [52, 168, 83] / 255;    % #34A853

% Extended palette for visualization
colors_classical = google_blue;
colors_neural = google_red;
color_highlight = google_green;
color_region = [google_green, 0.15];  % With alpha

%% ========================================================================
%  FIGURE SETUP
%  ========================================================================

figureUnits = 'centimeters';
figureWidth = 16;
figureHeight = 12;

figureHandle = figure('Name', 'Pitch Detection Comparison');
set(gcf, 'Units', figureUnits, 'Position', [2 2 figureWidth figureHeight]);
set(gcf, 'Color', [1 1 1]);

hold on;

%% ========================================================================
%  BROWSER-FEASIBLE REGION (shaded area)
%  ========================================================================

% Browser feasible: latency < 10ms, no GPU required
x_region = [0.01, 10, 10, 0.01];
y_region = [84, 84, 100, 100];
fill(x_region, y_region, google_green, ...
    'FaceAlpha', 0.08, ...
    'EdgeColor', 'none');

% Add region label
text(0.025, 85.5, 'Browser-Feasible Region', ...
    'FontName', 'Times New Roman', ...
    'FontSize', 9, ...
    'FontAngle', 'italic', ...
    'Color', google_green * 0.7);

%% ========================================================================
%  SCATTER PLOT WITH BUBBLES
%  ========================================================================

% Normalize bubble sizes (min 80, max 600)
ops_norm = (ops - min(ops)) / (max(ops) - min(ops));
bubble_sizes = 80 + ops_norm * 520;

% Plot by category
for i = 1:length(names)
    if strcmp(category{i}, 'Classical')
        c = google_blue;
        marker = 'o';
    else
        c = google_red;
        marker = 's';
    end

    % Special highlight for YIN (our choice)
    if strcmp(names{i}, 'YIN')
        scatter(latency(i), accuracy(i), bubble_sizes(i) * 1.2, ...
            'MarkerFaceColor', google_green, ...
            'MarkerEdgeColor', [0.2 0.2 0.2], ...
            'MarkerFaceAlpha', 0.85, ...
            'LineWidth', 2.5, ...
            'Marker', 'p');  % Star marker for YIN
    else
        scatter(latency(i), accuracy(i), bubble_sizes(i), ...
            'MarkerFaceColor', c, ...
            'MarkerEdgeColor', [0.3 0.3 0.3], ...
            'MarkerFaceAlpha', 0.7, ...
            'LineWidth', 1, ...
            'Marker', marker);
    end
end

%% ========================================================================
%  LABELS FOR EACH ALGORITHM
%  ========================================================================

% Label offsets to avoid overlap [dx, dy]
offsets = {
    [0.08, 0.6];      % YIN
    [-0.12, -1.2];    % Autocorrelation
    [0.15, -0.8];     % CREPE
    [0.12, 0.7];      % FCPE
    [-0.02, 1.0];     % OneBitPitch
    [0.1, -0.9];      % PYIN
    [0.1, 0.6];       % SWIPE
};

for i = 1:length(names)
    % Calculate position in log scale
    dx = offsets{i}(1);
    dy = offsets{i}(2);

    text(latency(i) * 10^dx, accuracy(i) + dy, names{i}, ...
        'FontName', 'Times New Roman', ...
        'FontSize', 9, ...
        'HorizontalAlignment', 'left', ...
        'VerticalAlignment', 'middle', ...
        'Color', [0.15 0.15 0.15]);
end

%% ========================================================================
%  AXIS CONFIGURATION
%  ========================================================================

set(gca, 'XScale', 'log');
set(gca, 'XLim', [0.03, 15]);
set(gca, 'YLim', [88, 99.5]);

% X-axis ticks
set(gca, 'XTick', [0.05, 0.1, 0.5, 1, 2, 5, 10]);
set(gca, 'XTickLabel', {'0.05', '0.1', '0.5', '1', '2', '5', '10'});

% Y-axis ticks
set(gca, 'YTick', 88:2:100);

%% ========================================================================
%  STYLING
%  ========================================================================

% Axis properties
set(gca, 'Box', 'off', ...
    'LineWidth', 1.2, ...
    'TickDir', 'out', ...
    'TickLength', [0.015 0.015], ...
    'XColor', [0.15 0.15 0.15], ...
    'YColor', [0.15 0.15 0.15], ...
    'XGrid', 'on', ...
    'YGrid', 'on', ...
    'GridLineStyle', ':', ...
    'GridAlpha', 0.3, ...
    'XMinorGrid', 'off', ...
    'YMinorGrid', 'off');

% Font settings
set(gca, 'FontName', 'Times New Roman', 'FontSize', 11);

% Labels
hXLabel = xlabel('Processing Latency (ms)', ...
    'FontName', 'Times New Roman', ...
    'FontSize', 12);
hYLabel = ylabel('Detection Accuracy (%)', ...
    'FontName', 'Times New Roman', ...
    'FontSize', 12);

% Title
hTitle = title('Pitch Detection Algorithm Comparison', ...
    'FontName', 'Times New Roman', ...
    'FontSize', 13, ...
    'FontWeight', 'bold');

%% ========================================================================
%  LEGEND
%  ========================================================================

% Create dummy plots for legend
h1 = scatter(nan, nan, 120, 'o', ...
    'MarkerFaceColor', google_blue, ...
    'MarkerEdgeColor', [0.3 0.3 0.3], ...
    'MarkerFaceAlpha', 0.7);
h2 = scatter(nan, nan, 120, 's', ...
    'MarkerFaceColor', google_red, ...
    'MarkerEdgeColor', [0.3 0.3 0.3], ...
    'MarkerFaceAlpha', 0.7);
h3 = scatter(nan, nan, 180, 'p', ...
    'MarkerFaceColor', google_green, ...
    'MarkerEdgeColor', [0.2 0.2 0.2], ...
    'MarkerFaceAlpha', 0.85, ...
    'LineWidth', 2);

hLegend = legend([h1, h2, h3], ...
    {'Classical DSP', 'Neural Network', 'YIN (Selected)'}, ...
    'Location', 'southeast', ...
    'Box', 'off', ...
    'FontName', 'Times New Roman', ...
    'FontSize', 10);

%% ========================================================================
%  BUBBLE SIZE LEGEND (manual annotation)
%  ========================================================================

% Position for bubble size legend
annotation('textbox', [0.72, 0.78, 0.2, 0.15], ...
    'String', {'Bubble Size:', 'Computational', 'Cost (ops/frame)'}, ...
    'FontName', 'Times New Roman', ...
    'FontSize', 9, ...
    'EdgeColor', 'none', ...
    'HorizontalAlignment', 'center', ...
    'VerticalAlignment', 'top');

%% ========================================================================
%  ADD TOP AND RIGHT BORDER
%  ========================================================================

xc = get(gca, 'XColor');
yc = get(gca, 'YColor');
unit = get(gca, 'Units');
ax = axes('Units', unit, ...
    'Position', get(gca, 'Position'), ...
    'XAxisLocation', 'top', ...
    'YAxisLocation', 'right', ...
    'Color', 'none', ...
    'XColor', xc, ...
    'YColor', yc, ...
    'XScale', 'log');
set(ax, 'LineWidth', 1.2, ...
    'XTick', [], ...
    'YTick', [], ...
    'XLim', [0.03, 15], ...
    'YLim', [88, 99.5]);

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
print(figureHandle, fullfile(outputPath, 'figure1_pitch_detection_comparison.png'), ...
    '-dpng', '-r300');

% Export as PDF (vector)
print(figureHandle, fullfile(outputPath, 'figure1_pitch_detection_comparison.pdf'), ...
    '-dpdf', '-bestfit');

% Export as EPS (vector)
print(figureHandle, fullfile(outputPath, 'figure1_pitch_detection_comparison.eps'), ...
    '-depsc2');

fprintf('Figure 1 exported successfully!\n');
fprintf('Output location: %s\n', outputPath);
