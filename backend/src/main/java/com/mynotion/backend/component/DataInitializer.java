package com.mynotion.backend.component;

import com.mynotion.backend.entity.Document;
import com.mynotion.backend.repository.DocumentRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

@Component
public class DataInitializer implements CommandLineRunner {

    private final DocumentRepository documentRepository;

    public DataInitializer(DocumentRepository documentRepository) {
        this.documentRepository = documentRepository;
    }

    @Override
    public void run(String... args) throws Exception {
        if (documentRepository.count() == 0) {
            String content = "這是一個支援 **區塊化編輯** 與 **即時渲染** 的現代編輯器！\n\n" +
                    "> 您可以像使用 Notion 一樣，在這裡自由地記錄靈感與想法。試著把滑鼠移到這段文字左邊，按住拖曳把手，把這個區塊拉到最下面！\n\n" +
                    "## 核心功能特色\n\n" +
                    "1. **區塊化編輯**：按下 `Enter` 會自動產生新的獨立區塊\n\n" +
                    "2. **拖曳排序**：抓住區塊左側的 `6個小點圖示`，即可任意上下調整段落順序\n\n" +
                    "3. **即時預覽**：點擊區塊外部，或切換到下一個段落，Markdown 語法就會瞬間變成漂亮排版\n\n" +
                    "## 程式碼高亮\n\n" +
                    "完全支援各種語言的程式碼語法高亮：\n\n" +
                    "```javascript\n" +
                    "function greet(name) {\n" +
                    "  console.log(`Hello, ${name}!`);\n" +
                    "}\n" +
                    "greet('Antigravity');\n" +
                    "```\n\n" +
                    "## 表格與圖表\n\n" +
                    "| 功能 | 支援度 | 備註 |\n" +
                    "| :--- | :---: | :--- |\n" +
                    "| 粗斜體 | ✅ | `**粗體**` |\n" +
                    "| 待辦事項 | ✅ | `- [x] 完成` |\n" +
                    "| 拖曳排序 | ✅ | CDK 支援 |\n\n" +
                    "最酷的是，編輯器內建了 **Mermaid** 圖表渲染引擎：\n\n" +
                    "```mermaid\n" +
                    "graph TD;\n" +
                    "    A[寫下靈感] --> B{加入圖表?};\n" +
                    "    B -- 是 --> C[使用 Mermaid 語法];\n" +
                    "    B -- 否 --> D[使用 Markdown 排版];\n" +
                    "    C --> E[匯出成精美文件];\n" +
                    "    D --> E;\n" +
                    "```";

            Document sampleDoc = Document.builder()
                    .title("歡迎使用筆記！👋")
                    .content(content)
                    .icon("description")
                    .build();

            documentRepository.save(sampleDoc);
            
            System.out.println("✅ 已自動建立範例文件 (DataInitializer)");
        }
    }
}
