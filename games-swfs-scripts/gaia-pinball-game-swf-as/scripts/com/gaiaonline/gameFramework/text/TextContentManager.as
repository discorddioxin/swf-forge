package com.gaiaonline.gameFramework.text
{
   import flash.text.*;
   
   public class TextContentManager
   {
      
      private static var allowInstantiation:Boolean;
      
      private static var instance:TextContentManager;
      
      private var xmlArr:Array = new Array();
      
      public function TextContentManager()
      {
         super();
         if(!allowInstantiation)
         {
            throw new Error("Error: Instantiation failed: Use SingletonDemo.getInstance() instead of new.");
         }
      }
      
      public static function getInstance() : TextContentManager
      {
         if(instance == null)
         {
            allowInstantiation = true;
            instance = new TextContentManager();
            allowInstantiation = false;
         }
         return instance;
      }
      
      private function dTrace(param1:String) : void
      {
         trace("[TextContentManager]" + param1);
      }
      
      public function getText(param1:String) : String
      {
         var _loc2_:int = 0;
         var _loc3_:XMLList = null;
         var _loc4_:String = null;
         _loc2_ = 0;
         while(_loc2_ < xmlArr.length)
         {
            _loc3_ = xmlArr[_loc2_][param1];
            _loc4_ = String(_loc3_.text());
            if(_loc4_ != "")
            {
               return _loc4_;
            }
            _loc2_++;
         }
         return "";
      }
      
      public function addXml(param1:XML) : void
      {
         xmlArr.push(param1);
      }
      
      public function hasEntry(param1:String) : Boolean
      {
         var _loc2_:int = 0;
         var _loc3_:XMLList = null;
         var _loc4_:String = null;
         _loc2_ = 0;
         while(_loc2_ < xmlArr.length)
         {
            _loc3_ = xmlArr[_loc2_][param1];
            _loc4_ = String(_loc3_.text());
            if(_loc4_ != "")
            {
               return true;
            }
            _loc2_++;
         }
         return false;
      }
      
      public function setTextField(param1:TextField) : void
      {
         var _loc2_:String = null;
         _loc2_ = param1.name.split("_")[0];
         param1.text = getText(_loc2_);
      }
   }
}

