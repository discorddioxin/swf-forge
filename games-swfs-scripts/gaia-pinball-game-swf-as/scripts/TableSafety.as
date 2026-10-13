package
{
   import com.gaiaonline.games.gPinball.compound_elements.ToggleGroup;
   
   [Embed(source="/_assets/assets.swf", symbol="symbol1173")]
   public dynamic class TableSafety extends ToggleGroup
   {
      
      public function TableSafety()
      {
         super();
         addFrameScript(0,frame1,29,frame30,59,frame60);
      }
      
      internal function frame1() : *
      {
         stop();
         init(null);
      }
      
      internal function frame30() : *
      {
         stop();
         makeReady();
      }
      
      internal function frame60() : *
      {
         gotoAndStop(1);
      }
   }
}

