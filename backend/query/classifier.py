import re
from enum import Enum


class QueryType(str, Enum):
    WHERE = "where"
    WHY = "why"
    EXPLAIN = "explain"
    REFACTOR = "refactor"
    DEBUG = "debug"
    GENERAL = "general"


WHERE_PATTERNS = [
    r'\bwhere\b', r'\bfind\b', r'\blocate\b', r'\bwhich file\b',
    r'\bwhere is\b', r'\bwhere are\b', r'\bwhere does\b',
    r'\bimplemented\b', r'\blocation\b', r'\bfile.*contain\b',
]

WHY_PATTERNS = [
    r'\bwhy\b', r'\breason\b', r'\bcause\b', r'\bcausing\b',
    r'\bwhy does\b', r'\bwhy is\b', r'\bwhat causes\b',
]

EXPLAIN_PATTERNS = [
    r'\bexplain\b', r'\bhow does\b', r'\bwhat does\b', r'\bdescribe\b',
    r'\bunderstand\b', r'\bwhat is\b', r'\bhow is\b', r'\bwalk me through\b',
    r'\bwhat.*do\b', r'\btell me about\b',
]

REFACTOR_PATTERNS = [
    r'\brefactor\b', r'\bimprove\b', r'\boptimize\b', r'\brewrite\b',
    r'\bclean up\b', r'\bmake.*better\b', r'\bfix.*code\b', r'\bsuggest\b',
    r'\bbest practice\b', r'\bcode.*review\b',
]

DEBUG_PATTERNS = [
    r'\bdebug\b', r'\btrace\b', r'\btrack down\b', r'\broot cause\b',
    r'\bstack trace\b', r'\bexception\b', r'\bcrash\b', r'\bbug\b',
    r'\berror\b', r'\bfail\b', r'\bbroken\b',
]


def classify_query(question: str) -> QueryType:
    q = question.lower()
    scores = {
        QueryType.WHERE: sum(1 for p in WHERE_PATTERNS if re.search(p, q)),
        QueryType.WHY: sum(1 for p in WHY_PATTERNS if re.search(p, q)),
        QueryType.EXPLAIN: sum(1 for p in EXPLAIN_PATTERNS if re.search(p, q)),
        QueryType.REFACTOR: sum(1 for p in REFACTOR_PATTERNS if re.search(p, q)),
        QueryType.DEBUG: sum(1 for p in DEBUG_PATTERNS if re.search(p, q)),
    }
    best = max(scores, key=scores.get)
    if scores[best] == 0:
        return QueryType.GENERAL
    return best
