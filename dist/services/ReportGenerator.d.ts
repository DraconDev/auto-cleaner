import { AnalysisResult } from "../core/IAnalyzer";
import { CSSAnalysisResults } from "./CSSAnalyzer";
export declare class ReportGenerator {
    generateReport(cssResults: CSSAnalysisResults, otherResults?: AnalysisResult[]): string;
    private appendCSSDetails;
    showReport(cssResults: CSSAnalysisResults, otherResults?: AnalysisResult[]): Promise<void>;
}
//# sourceMappingURL=ReportGenerator.d.ts.map