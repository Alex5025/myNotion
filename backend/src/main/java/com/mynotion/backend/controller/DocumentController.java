package com.mynotion.backend.controller;

import com.mynotion.backend.entity.Document;
import com.mynotion.backend.repository.DocumentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/documents")
@RequiredArgsConstructor
public class DocumentController {

    private final DocumentRepository documentRepository;

    @GetMapping
    public List<Document> getAllDocuments() {
        return documentRepository.findAllByOrderByUpdatedAtDesc();
    }

    @GetMapping("/{id}")
    public ResponseEntity<Document> getDocument(@PathVariable Long id) {
        return documentRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
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
    public ResponseEntity<Document> updateDocument(@PathVariable Long id,
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
    public ResponseEntity<Void> deleteDocument(@PathVariable Long id) {
        if (documentRepository.existsById(id)) {
            documentRepository.deleteById(id);
            return ResponseEntity.ok().build();
        }
        return ResponseEntity.notFound().build();
    }
}
