//! Text chunking for embedding generation

/// Text chunker for splitting long statements into embeddable segments
pub struct TextChunker {
    /// Maximum characters per chunk (optimal for BGE-small-en-v1.5)
    max_chars: usize,
    /// Overlap between chunks as a fraction (0.0-1.0)
    overlap_ratio: f32,
}

impl Default for TextChunker {
    fn default() -> Self {
        Self::new(1500, 0.1)
    }
}

impl TextChunker {
    /// Creates a new text chunker
    #[must_use]
    pub const fn new(max_chars: usize, overlap_ratio: f32) -> Self {
        Self {
            max_chars,
            overlap_ratio,
        }
    }

    /// Chunk a text into segments suitable for embedding
    #[must_use]
    pub fn chunk(&self, text: &str) -> Vec<String> {
        let text = text.trim();
        if text.is_empty() {
            return Vec::new();
        }

        if text.len() <= self.max_chars {
            return vec![text.to_string()];
        }

        let overlap = (self.max_chars as f32 * self.overlap_ratio) as usize;
        let mut chunks = Vec::new();
        let mut start = 0;

        while start < text.len() {
            let end = std::cmp::min(start + self.max_chars, text.len());

            // Try to find a sentence boundary near the end
            let chunk_end = if end < text.len() {
                self.find_sentence_boundary(text, start, end)
            } else {
                end
            };

            let chunk = text[start..chunk_end].trim().to_string();
            if !chunk.is_empty() {
                chunks.push(chunk);
            }

            if chunk_end >= text.len() {
                break;
            }

            // Move start back by overlap amount
            start = chunk_end.saturating_sub(overlap);
            if start == 0 && chunk_end > 0 {
                start = chunk_end;
            }
        }

        chunks
    }

    /// Find a sentence boundary near the target position
    fn find_sentence_boundary(&self, text: &str, start: usize, end: usize) -> usize {
        // Search backwards from end for sentence-ending punctuation
        let search_start = std::cmp::max(start + (self.max_chars / 2), end.saturating_sub(200));
        let search_region = &text[search_start..end];

        // Look for sentence boundaries
        let sentence_ends = [". ", "! ", "? ", ".\n", "!\n", "?\n", ".\t", "!\t", "?\t"];

        let mut best_pos = None;
        for ending in sentence_ends {
            if let Some(pos) = search_region.rfind(ending) {
                let abs_pos = search_start + pos + 1;
                if best_pos.is_none() || abs_pos > best_pos.unwrap_or(0) {
                    best_pos = Some(abs_pos);
                }
            }
        }

        best_pos.unwrap_or(end)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_short_text() {
        let chunker = TextChunker::default();
        let result = chunker.chunk("Hello world");
        assert_eq!(result, vec!["Hello world"]);
    }

    #[test]
    fn test_empty_text() {
        let chunker = TextChunker::default();
        let result = chunker.chunk("");
        assert!(result.is_empty());
    }

    #[test]
    fn test_long_text_with_sentences() {
        let chunker = TextChunker::new(100, 0.1);
        let text = "This is the first sentence. This is the second sentence. This is the third sentence that is a bit longer.";
        let result = chunker.chunk(text);
        assert!(result.len() > 1);
        assert!(result[0].ends_with('.') || result[0].ends_with("sentence"));
    }
}
