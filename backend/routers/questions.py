"""Product Q&A — visitors can ask a question on a product page without an account (useful for
undecided buyers who haven't signed up yet). Same moderation gate as reviews: a question stays
unpublished until an admin answers it, so a duplicate/off-topic/spam question is never visible.
"""
from fastapi import APIRouter, HTTPException, Depends, Request, Path, Query

import deps
from deps import db, get_current_admin, new_id, now_utc, iso
from models import ProductQuestionIn, QuestionAnswerIn
from security import get_client_ip
from audit import record_audit

router = APIRouter(tags=["questions"])


@router.get("/questions/product/{product_id}")
async def product_questions(product_id: str = Path(min_length=1, max_length=64)):
    return await db.questions.find(
        {"product_id": product_id, "answered": True}, {"_id": 0}
    ).sort("answered_at", -1).to_list(200)


@router.post("/questions")
async def create_question(body: ProductQuestionIn, request: Request):
    deps.check_public_rate_limit(request, "create_question")
    if not await db.products.find_one({"id": body.product_id}, {"_id": 0, "id": 1}):
        raise HTTPException(status_code=404, detail="Product not found")
    doc = body.model_dump()
    doc["id"] = new_id()
    doc["answer"] = None
    doc["answered"] = False
    doc["answered_at"] = None
    doc["created_at"] = iso(now_utc())
    await db.questions.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.get("/admin/questions")
async def admin_list_questions(
    answered: bool | None = Query(None),
    admin: dict = Depends(get_current_admin),
):
    filt = {} if answered is None else {"answered": answered}
    return await db.questions.find(filt, {"_id": 0}).sort("created_at", -1).to_list(500)


@router.put("/admin/questions/{question_id}/answer")
async def answer_question(
    body: QuestionAnswerIn,
    request: Request,
    admin: dict = Depends(get_current_admin),
    question_id: str = Path(min_length=1, max_length=64),
):
    deps.check_authenticated_rate_limit(request, "admin_write", admin["id"])
    question = await db.questions.find_one({"id": question_id})
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    await db.questions.update_one(
        {"id": question_id},
        {"$set": {"answer": body.answer, "answered": True, "answered_at": iso(now_utc())}},
    )
    await record_audit(db, admin["email"], get_client_ip(request), "answer_question", question_id, {"product_id": question["product_id"]})
    return await db.questions.find_one({"id": question_id}, {"_id": 0})


@router.delete("/admin/questions/{question_id}")
async def delete_question(
    request: Request,
    admin: dict = Depends(get_current_admin),
    question_id: str = Path(min_length=1, max_length=64),
):
    deps.check_authenticated_rate_limit(request, "admin_write", admin["id"])
    if not await db.questions.find_one({"id": question_id}, {"_id": 0, "id": 1}):
        raise HTTPException(status_code=404, detail="Question not found")
    await db.questions.delete_one({"id": question_id})
    await record_audit(db, admin["email"], get_client_ip(request), "delete_question", question_id)
    return {"ok": True}
