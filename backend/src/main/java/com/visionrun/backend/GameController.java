
package com.visionrun.backend;

import com.visionrun.backend.model.GameScore;
import com.visionrun.backend.repository.GameScoreRepository;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*")
public class GameController {

    private final GameScoreRepository repository;

    public GameController(GameScoreRepository repository) {
        this.repository = repository;
    }

    // Backend health check
    @GetMapping("/health")
    public java.util.Map<String, String> health() {
        return java.util.Map.of(
            "project", "VisionRun",
            "status", "Backend is running",
            "message", "Welcome to VisionRun!"
        );
    }

    // Save completed game score
    @PostMapping("/scores")
    public GameScore saveScore(@RequestBody GameScore score) {
        if (score.getPlayerName() == null ||
            score.getPlayerName().isBlank()) {
            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST, "Player name is required");
        }

        if (score.getScore() < 0 || score.getCoinsCollected() < 0) {
            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST, "Score and coins cannot be negative");
        }

        score.setPlayerName(score.getPlayerName().trim());
        return repository.save(score);
    }

    // Get all scores
    @GetMapping("/scores")
    public List<GameScore> getAllScores() {
        return repository.findAll();
    }

    // Get top 10 leaderboard scores
    @GetMapping("/scores/leaderboard")
    public List<GameScore> getLeaderboard() {
        return repository.findTop10ByOrderByScoreDesc();
    }

    // Get a player's game history
    @GetMapping("/scores/player/{name}")
    public List<GameScore> getPlayerScores(@PathVariable String name) {
        return repository.findByPlayerNameOrderByPlayedAtDesc(name);
    }
}
