package com.mynotion.backend.controller;

import com.mynotion.backend.entity.Document;
import com.mynotion.backend.repository.DocumentRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/documents")
@CrossOrigin(origins = "http://localhost:5173", maxAge = 3600)
@RequiredArgsConstructor
@Tag(name = "文件管理", description = "提供文件的 CRUD 操作 API")
public class DocumentController {

    private final DocumentRepository documentRepository;

    @GetMapping
    @Operation(summary = "獲取所有文件", description = "回傳資料庫中所有文件的清單，按最後更新時間降序排列")
    public List<Document> getAllDocuments() {
        return documentRepository.findAllByOrderByUpdatedAtDesc();
    }

    @GetMapping("/{id}")
    @Operation(summary = "獲取單一文件詳情", description = "根據 ID 查詢特定文件的詳細內容")
    @ApiResponse(responseCode = "200", description = "成功找到文件")
    @ApiResponse(responseCode = "404", description = "找不到該 ID 對應的文件")
    public ResponseEntity<Document> getDocument(
            @Parameter(description = "文件的唯一標識 ID") @PathVariable Long id) {
        return documentRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    @Operation(summary = "建立新文件", description = "建立一個新的文件，若未提供內容則使用預設值")
    public Document createDocument(@RequestBody(required = false) Document document) {
        if (document == null) {
            document = new Document();
        }
        if (document.getTitle() == null || document.getTitle().isBlank()) {
            document.setTitle("未命名文件");
        }
        if (document.getContent() == null) {
            document.setContent("");
        }
        if (document.getIcon() == null) {
            document.setIcon("📄");
        }
        return documentRepository.save(document);
    }

    @PutMapping("/{id}")
    @Operation(summary = "更新文件內容", description = "根據 ID 更新指定文件的標題、內容或圖示")
    @ApiResponse(responseCode = "200", description = "文件更新完畢")
    @ApiResponse(responseCode = "404", description = "找不到該文件")
    public ResponseEntity<Document> updateDocument(
            @Parameter(description = "要更新的文件 ID") @PathVariable Long id,
            @RequestBody Map<String, String> updates) {
        return documentRepository.findById(id)
                .map(doc -> {
                    if (updates.containsKey("title")) {
                        doc.setTitle(updates.get("title"));
                    }
                    if (updates.containsKey("content")) {
                        doc.setContent(updates.get("content"));
                    }
                    if (updates.containsKey("icon")) {
                        doc.setIcon(updates.get("icon"));
                    }
                    return ResponseEntity.ok(documentRepository.save(doc));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "刪除文件", description = "根據 ID 永久刪除指定文件")
    @ApiResponse(responseCode = "200", description = "文件刪除成功")
    @ApiResponse(responseCode = "404", description = "文件不存在")
    public ResponseEntity<Void> deleteDocument(
            @Parameter(description = "要刪除的文件 ID") @PathVariable Long id) {
        if (documentRepository.existsById(id)) {
            documentRepository.deleteById(id);
            return ResponseEntity.ok().build();
        }
        return ResponseEntity.notFound().build();
    }
}
