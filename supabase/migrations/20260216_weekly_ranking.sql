-- Function to get weekly creator ranking based on diamonds earned
CREATE OR REPLACE FUNCTION get_weekly_creator_ranking(p_limit integer DEFAULT 99)
RETURNS TABLE (
  rank bigint,
  user_id uuid,
  username text,
  display_name text,
  avatar_url text,
  total_diamonds bigint
) AS $$
BEGIN
  RETURN QUERY
  WITH weekly_stats AS (
    SELECT
      gt.receiver_id,
      SUM(gt.diamonds_earned) as diamonds
    FROM
      gift_transactions gt
    WHERE
      gt.created_at >= date_trunc('week', now())
    GROUP BY
      gt.receiver_id
  )
  SELECT
    RANK() OVER (ORDER BY ws.diamonds DESC) as rank,
    p.user_id,
    p.username,
    p.display_name,
    p.avatar_url,
    COALESCE(ws.diamonds, 0)::bigint as total_diamonds
  FROM
    weekly_stats ws
  JOIN
    profiles p ON ws.receiver_id = p.user_id
  WHERE
    p.is_creator = true
  ORDER BY
    total_diamonds DESC
  LIMIT
    p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
