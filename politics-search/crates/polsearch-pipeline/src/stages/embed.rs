//! Text embedding stage using fastembed

use fastembed::{EmbeddingModel, InitOptions, TextEmbedding};

/// Text embedder using BGE-small-en-v1.5 (384-dim)
pub struct TextEmbedder(TextEmbedding);

impl TextEmbedder {
    /// Initialize the embedding model
    ///
    /// # Errors
    /// Returns an error if the embedding model fails to initialize
    pub fn new() -> color_eyre::Result<Self> {
        let model = TextEmbedding::try_new(InitOptions::new(EmbeddingModel::BGESmallENV15))
            .map_err(|e| color_eyre::eyre::eyre!("Failed to initialize embedding model: {}", e))?;
        Ok(Self(model))
    }

    /// Embed a batch of text segments
    ///
    /// # Errors
    /// Returns an error if embedding generation fails
    pub fn embed_batch(&mut self, texts: &[&str]) -> color_eyre::Result<Vec<Vec<f32>>> {
        self.0
            .embed(texts, None)
            .map_err(|e| color_eyre::eyre::eyre!("Embedding failed: {}", e))
    }

    /// Embed a single text
    ///
    /// # Errors
    /// Returns an error if embedding generation fails
    pub fn embed(&mut self, text: &str) -> color_eyre::Result<Vec<f32>> {
        let mut embeddings = self
            .0
            .embed(vec![text], None)
            .map_err(|e| color_eyre::eyre::eyre!("Embedding failed: {}", e))?;
        Ok(embeddings.swap_remove(0))
    }
}
