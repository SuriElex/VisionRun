
package com.visionrun.backend.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.visionrun.backend.model.GameScore;

public interface GameScoreRepository extends JpaRepository<GameScore, Long> {

    List<GameScore> findTop10ByOrderByScoreDesc();

    List<GameScore> findByPlayerNameOrderByPlayedAtDesc(String playerName);
}
